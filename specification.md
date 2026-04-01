# SnowDesk — Technical Specification

**Version:** 1.0
**Date:** 27 March 2026
**Status:** Ready for development

---

## 1. Overview

SnowDesk is a daily snow condition briefing for skiers and snowboarders in the Alps. It uses the official Swiss Federal Institute for Snow and Avalanche Reseach (SLF) bulletin, analysed by Claude, to generate a simple condition report for a given resort / area.

The SLF bulletin is published twice daily - at 08:00 CET and 17:00 CET.

The website displays the report for a given day and resort. In addition, users can sign up to the service and receive the report daily via email.

The website is currently implemented in Next.js and is hosted on Vercel, using Supabase as the backend. This document describes the full product as built, to serve as the source of truth for that migration.

---

## 2. User-facing features

### 2.0 Homepage

A single page that displays the latest bulletin for a random resort (from the list of known resorts). In addition the homepage should describe the purpose of the site, and give instructions on how to subscribe.

### 2.1 Resort page (`\{resort-slug}`)

Each resort has a page that displays the resort on a map, contains some summary information about the resort (static content), and then displays the latest bulletin summary.

Each resort page shows a "subscribe to {resort-name}" form that allows the user to put in their email address and subscribe to daily updates.

### 2.2 Resort + date page (`\{resort-slug}\{date}`)

The resort date page shows the historical bulletin(s) for the given date.

### 2.1 Sign-up page (`/`)

A single-page marketing and sign-up interface.

From top to bottom:

1. **Masthead** — logo ("SnowDesk") and tagline ("Daily avalanche briefings · Swiss Alps")
2. **Hero** — headline "Know before you drop in", short description, and three danger-level pills (Go / Caution / Avoid backcountry)
3. **Live bulletin preview** — a card showing today's real bulletin for Verbier / Haut Val de Bagnes (region 4116), loaded from a Supabase cache. Shows verdict badge, summary, 8-cell weather grid, conditions rows (on-piste / off-piste / ski touring), outlook, and a link to the source bulletin on whiterisk.ch
4. **Subscribe divider**
5. **Sign-up form** — collects email, region, skiing style, and delivery preference
6. **Footer** — copyright and data source attribution

### 2.2 Sign-up form fields

| Field        | Type           | Options                                                  | Notes                                    |
| ------------ | -------------- | -------------------------------------------------------- | ---------------------------------------- |
| Email        | email input    | —                                                        | Required                                 |
| Region area  | select         | 17 areas across Swiss Alps                               | Required. See region map in §6           |
| Sub-region   | select         | Populated dynamically from area selection                | Optional. Defaults to first code in area |
| Skiing style | checkbox tiles | On-piste, Off-piste / powder, Ski touring                | Multi-select. At least one required      |
| Delivery     | radio tiles    | Morning only (08:15 CET), Evening only (17:15 CET), Both | Single-select. Default: Morning          |

On submit, the form POSTs to `/api/subscribe`. On success, it shows a confirmation panel. The user must click a link in a confirmation email before they receive briefings.

### 2.3 Email briefing

Each briefing email contains:

- **Header** — "SnowDesk", region name, date, bulletin edition time
- **Verdict badge** — coloured box with overall verdict (GO / CAUTION / STAY ON PISTE / AVOID BACKCOUNTRY) and danger level
- **Summary** — 2–3 sentence plain-English overview
- **Weather grid** — 8 cells: summit temp, mid-mountain temp, resort temp, freezing level, wind, visibility, new snow (24h), base depth
- **Conditions** — three rows (on-piste, off-piste, ski touring), each with a rating and a note
- **Key hazards** — 2–4 bullet points
- **Best bets** — 1–3 suggestions for safe terrain or activities
- **Outlook** — 1–2 sentences on the next day and weekend
- **Footer** — source attribution and one-click unsubscribe link

### 2.4 Confirmation and unsubscribe

- After sign-up, a confirmation email is sent containing a unique link (`/api/confirm?token=<token>`)
- Clicking the link sets `confirmed = true` on the subscriber record
- Unconfirmed subscribers do not receive briefings
- Every briefing email contains an unsubscribe link (`/unsubscribe?token=<token>`) which permanently deletes the subscriber record

---

## 3. Architecture

```
Browser
  └── Sign-up page (React, client-rendered)
        ├── GET /api/preview  →  reads bulletin_previews cache from Supabase
        └── POST /api/subscribe  →  writes to subscribers table, sends confirmation email

Vercel Cron (08:15 + 17:15 CET)
  └── GET /api/cron/send
        ├── Warms bulletin_previews cache for region 4116 (Verbier preview)
        ├── Fetches SLF bulletin PDFs from aws.slf.ch for each subscriber region
        ├── Calls Claude API to analyse each bulletin
        ├── Sends personalised briefing emails via Resend
        └── Logs sends to send_log table

Email links
  ├── GET /api/confirm?token=  →  sets confirmed = true
  └── GET /unsubscribe?token=  →  deletes subscriber record
```

---

## 4. API routes

### `POST /api/subscribe`

Validates input, upserts a subscriber row in Supabase, and sends a confirmation email via Resend.

**Request body (JSON):**

```json
{
  "email": "user@example.com",
  "region_area": "verbier",
  "region_code": "4116",
  "styles": ["piste", "offpiste"],
  "delivery": "morning"
}
```

**Validation:**

- `email` — valid email format
- `region_area` — must exist in REGION_MAP
- `styles` — array of `"piste" | "offpiste" | "touring"`, min length 1
- `delivery` — `"morning" | "evening" | "both"`

**On duplicate** (same email + region_area): upserts, overwrites preferences, resets `confirmed = false`, resends confirmation.

**Response:** `{ success: true }` or `{ error: string }` with appropriate HTTP status.

---

### `GET /api/confirm?token=<token>`

Finds the subscriber with the matching `unsubscribe_token` and sets `confirmed = true`. Redirects to `/?confirmed=true` on success, `/?error=confirm_failed` on failure.

---

### `GET /unsubscribe?token=<token>`

Deletes the subscriber row matching the token. Redirects to `/?unsubscribed=true`.

---

### `GET /api/preview`

Returns a cached `BulletinAnalysis` for Verbier region 4116, used to populate the live preview card on the sign-up page.

**Logic:**

1. Query `bulletin_previews` table for `region_code = '4116'`, ordered by `cached_at` descending
2. If a row exists, return `{ analysis, cached_at, source: "cache" }`
3. If not (first ever load, before cron has run), fetch live from SLF and call Claude, write result to `bulletin_previews`, return `{ analysis, source: "live" }`

**Cache-Control header:** `public, s-maxage=300, stale-while-revalidate=600`

---

### `GET /api/cron/send` _(protected)_

The daily send job. Called by Vercel's cron scheduler at 07:15 UTC and 16:15 UTC (08:15 and 17:15 CET). Also callable manually.

**Authentication:** `Authorization: Bearer <CRON_SECRET>` header required. Returns 401 if missing or incorrect.

**Logic:**

1. Determine slot (`morning` if UTC hour < 12, else `evening`)
2. Warm the preview cache for Verbier 4116 (always, regardless of subscribers)
3. Fetch all confirmed subscribers where `delivery = slot` or `delivery = 'both'`
4. Group subscribers by `region_area + region_code`
5. For each region group:
   a. Fetch bulletin text from SLF API
   b. Analyse once with `styles = ['piste','offpiste','touring']` — write to `bulletin_previews`
   c. For each subscriber in the group, re-analyse with their specific styles, send email, log to `send_log`
6. Return `{ sent, errors, slot }`

---

## 5. Database schema

All tables live in a Supabase (PostgreSQL) project. Run the following SQL to create them.

```sql
-- Pre-computed bulletin analyses for the sign-up page preview
-- Written by the cron job, read by /api/preview
create table bulletin_previews (
  region_code  text primary key,
  analysis     jsonb not null,
  cached_at    timestamptz not null default now()
);

-- Email subscribers
create table subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  region_area       text not null,
  region_code       text,
  styles            text[] not null default '{"piste"}',
  delivery          text not null default 'morning'
                      check (delivery in ('morning', 'evening', 'both')),
  confirmed         boolean not null default false,
  unsubscribe_token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at        timestamptz not null default now(),
  unique (email, region_area)
);

-- Index for fast cron queries
create index on subscribers (delivery, confirmed);

-- Send log — prevents duplicate sends, useful for debugging
create table send_log (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete cascade,
  region_code   text not null,
  send_slot     text not null,
  sent_at       timestamptz not null default now()
);

create index on send_log (subscriber_id, send_slot, sent_at);
```

---

## 6. Data types

### `BulletinAnalysis`

The structured JSON object produced by Claude and stored in `bulletin_previews.analysis`:

```typescript
interface BulletinAnalysis {
  date: string; // e.g. "26 March 2026"
  overallVerdict: string; // "GO" | "CAUTION" | "STAY ON PISTE" | "AVOID BACKCOUNTRY"
  verdictColour: "green" | "amber" | "red";
  dangerLevel: string; // e.g. "Considerable (3+)"
  summary: string; // 2-3 sentences
  onPiste: { rating: string; notes: string };
  offPiste: { rating: string; notes: string };
  skiTouring: { rating: string; notes: string };
  keyHazards: string[]; // 2-4 items
  bestBets: string[]; // 1-3 items
  outlook: string; // 1-2 sentences
  weather: {
    summitTemp: string; // e.g. "−10°C"
    midTemp: string; // e.g. "−4°C"
    resortTemp: string; // e.g. "0°C"
    freezingLevel: string; // e.g. "~1000m"
    wind: string; // e.g. "Storm NNW 80 km/h"
    visibility: string; // e.g. "Poor — heavy snowfall"
    newSnow24h: string; // e.g. "40–60 cm"
    baseDepth: string; // e.g. "200–240 cm (upper mountain)"
  };
}
```

### Rating values

| Field               | Possible values                        |
| ------------------- | -------------------------------------- |
| `onPiste.rating`    | Excellent, Good, Fair, Poor, Closed    |
| `offPiste.rating`   | Epic, Good, Risky, Very Risky, Avoid   |
| `skiTouring.rating` | Ideal, Acceptable, Experts Only, Avoid |

### `Subscriber`

```typescript
interface Subscriber {
  id: string;
  email: string;
  region_area: string; // slug, e.g. "verbier"
  region_code: string | null; // SLF code, e.g. "4116"
  styles: ("piste" | "offpiste" | "touring")[];
  delivery: "morning" | "evening" | "both";
  confirmed: boolean;
  unsubscribe_token: string; // 64-char hex, used in email links
  created_at: string;
}
```

---

## 7. External services and APIs

### 7.1 SLF Avalanche Bulletin API

The official Swiss avalanche bulletin, published by the WSL Institute for Snow and Avalanche Research.

**Base URL:** `https://aws.slf.ch/api/bulletin/document`

| Endpoint                    | Description                                  |
| --------------------------- | -------------------------------------------- |
| `/full/en`                  | Complete national bulletin PDF (all regions) |
| `/regional/en/{regionCode}` | Single-region bulletin PDF                   |

Bulletins update twice daily: **08:00 CET** and **17:00 CET**. The API returns a PDF which can be read as text. No authentication required. No rate limiting documented, but requests should be batched — one fetch per unique region code per cron run.

### 7.2 Anthropic Claude API

Used to analyse bulletin text and produce structured `BulletinAnalysis` JSON.

**Endpoint:** `POST https://api.anthropic.com/v1/messages`
**Model:** `claude-sonnet-4-20250514`
**Max tokens:** 1024

The system prompt instructs Claude to respond with raw JSON only (no markdown fences). The user message includes today's date, the region name, the subscriber's skiing styles, and the raw bulletin text.

Claude is called once per unique region per cron run for the preview cache write, then once per subscriber for personalised email analysis (personalisation is driven by different `styles` arrays in the prompt).

### 7.3 Resend

Transactional email delivery.

**API:** `https://api.resend.com`
**SDK:** `resend` npm package
**From address:** configured via `RESEND_FROM_ADDRESS` env var

Two email types are sent: confirmation emails (triggered by sign-up) and briefing emails (triggered by cron job).

### 7.4 Supabase

PostgreSQL database and authentication. Two clients are used:

- **Anon client** — used browser-side (safe to expose, governed by RLS if enabled)
- **Service role client** — used server-side only, has full table access, never exposed to the browser

---

## 8. Region map

Each area slug maps to one or more SLF region codes. The first code in the array is the default when no sub-region is selected.

| Area slug     | Area label             | Region codes                                                         |
| ------------- | ---------------------- | -------------------------------------------------------------------- |
| `verbier`     | Verbier / 4 Vallées    | 4115 (Martigny–Verbier), 4116 (Haut Val de Bagnes)                   |
| `zermatt`     | Zermatt / Saas Fee     | 4222 (Zermatt), 4223 (Saas Fee), 4224 (Monte Rosa)                   |
| `crans`       | Crans-Montana          | 4121 (Montana), 4124 (Val d'Anniviers)                               |
| `saas`        | Saas / Simplon         | 4231 (N. Simplon), 4232 (S. Simplon)                                 |
| `obergoms`    | Obergoms / Aletsch     | 4241 (Reckingen), 4243 (N. Obergoms), 4244 (S. Obergoms)             |
| `grindelwald` | Grindelwald / Jungfrau | 1242 (Grindelwald), 1234 (Jungfrau–Schilthorn), 1233 (Lauterbrunnen) |
| `adelboden`   | Adelboden / Lenk       | 1226 (Adelboden), 1224 (Lenk), 1227 (Engstligen)                     |
| `gstaad`      | Gstaad                 | 1222 (Gstaad), 1223 (Wildhorn)                                       |
| `kandersteg`  | Kandersteg             | 1231 (Kandersteg), 1232 (Blüemlisalp)                                |
| `davos`       | Davos / Klosters       | 5123 (Davos), 5122 (Schanfigg), 5111 (N. Prättigau)                  |
| `stmoritz`    | St. Moritz / Engadine  | 7114 (St Moritz), 7111 (Corvatsch), 7112 (Bernina)                   |
| `laax`        | Laax / Flims           | 5124 (Flims), 5214 (Obersaxen–Safien)                                |
| `arosa`       | Arosa / Lenzerheide    | 5221 (Domleschg–Lenzerheide), 5231 (Albulatal)                       |
| `andermatt`   | Andermatt / Sedrun     | 2223 (N. Urseren), 2224 (S. Urseren), 2221 (Meiental)                |
| `engelberg`   | Engelberg              | 2122 (Engelberg), 2121 (Glaubenberg)                                 |
| `lugano`      | Lugano area            | 6131 (Lugano area), 6132 (Mendrisio)                                 |
| `leventina`   | Leventina / Blenio     | 6112 (Upper Leventina), 6113 (Val Blenio)                            |

---

## 9. Environment variables

| Variable                        | Required | Description                                                |
| ------------------------------- | -------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anon key (safe for browser)                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | Supabase service role key (server only)                    |
| `ANTHROPIC_API_KEY`             | Yes      | Anthropic API key                                          |
| `RESEND_API_KEY`                | Yes      | Resend API key                                             |
| `RESEND_FROM_ADDRESS`           | Yes      | Verified sender address, e.g. `briefings@snowdesk.co`      |
| `CRON_SECRET`                   | Yes      | Random secret to protect the cron endpoint                 |
| `NEXT_PUBLIC_APP_URL`           | Yes      | Public URL of the deployed app, e.g. `https://snowdesk.co` |

---

## 10. Cron schedule

Two runs per day, fired 15 minutes after each SLF bulletin publication:

| Slot    | CET   | UTC   | cron expression |
| ------- | ----- | ----- | --------------- |
| Morning | 08:15 | 07:15 | `15 7 * * *`    |
| Evening | 17:15 | 16:15 | `15 16 * * *`   |

Note: UTC times do not account for daylight saving time. During CEST (late March–late October), CET is UTC+2, so the morning slot would need to be `15 6 * * *` and evening `15 15 * * *` for strict 15-minute accuracy. This is a known limitation and can be addressed with a timezone-aware scheduler if precision matters.

---

## 11. Email templates

### Confirmation email

Sent immediately on sign-up. Contains:

- Region name and delivery preference summary
- A single CTA button linking to `/api/confirm?token=<unsubscribe_token>`
- Note that the email can be ignored if the user didn't sign up

Subject: `Confirm your SnowDesk subscription`

### Briefing email

HTML only. Subject format: `🏔 {regionName} · {date}: {overallVerdict} — {dangerLevel}`

Example: `🏔 Haut Val de Bagnes · 26 March 2026: STAY ON PISTE — High (4−)`

All emails include an unsubscribe link: `{APP_URL}/unsubscribe?token=<unsubscribe_token>`

---

## 12. Claude prompt

### System prompt

```
You are an expert Swiss avalanche and ski conditions analyst.
Given raw SLF avalanche bulletin text, produce a structured daily briefing.
Respond ONLY with valid JSON — no markdown fences, no preamble, no trailing text.

Required JSON shape:
{
  "date": "string (e.g. 26 March 2026)",
  "overallVerdict": "GO | CAUTION | STAY ON PISTE | AVOID BACKCOUNTRY",
  "verdictColour": "green | amber | red",
  "dangerLevel": "e.g. Considerable (3+)",
  "summary": "2-3 sentence plain-English overview",
  "onPiste":    { "rating": "Excellent|Good|Fair|Poor|Closed", "notes": "1-2 sentences" },
  "offPiste":   { "rating": "Epic|Good|Risky|Very Risky|Avoid",  "notes": "1-2 sentences" },
  "skiTouring": { "rating": "Ideal|Acceptable|Experts Only|Avoid", "notes": "1-2 sentences" },
  "keyHazards": ["2-4 short strings"],
  "bestBets":   ["1-3 suggestions for safe terrain or activities"],
  "outlook":    "1-2 sentences on tomorrow and the weekend",
  "weather": {
    "summitTemp":    "e.g. −12°C",
    "midTemp":       "e.g. −6°C",
    "resortTemp":    "e.g. −1°C",
    "freezingLevel": "e.g. ~1000m",
    "wind":          "e.g. Storm NNW 80 km/h",
    "visibility":    "e.g. Poor — heavy snowfall",
    "newSnow24h":    "e.g. 40–60 cm",
    "baseDepth":     "e.g. 200–240 cm (upper mountain)"
  }
}
```

### User message format

```
Today is {date}. Region: {regionName}. The subscriber is interested in: {styles}.

Bulletin data:
{bulletinText}

Respond with JSON only.
```

---

## 13. Design tokens

The sign-up page uses a bespoke design system. Key values for migration:

### Colour palette

| Token         | Value     | Usage                                    |
| ------------- | --------- | ---------------------------------------- |
| `--cream`     | `#f5f0e8` | Page background                          |
| `--ink`       | `#1a1612` | Primary text, borders                    |
| `--ink-mid`   | `#4a4035` | Secondary text                           |
| `--ink-light` | `#8a7d6e` | Labels, hints                            |
| `--ink-faint` | `#c5b9a8` | Borders, dividers                        |
| `--alpine`    | `#2d4a3e` | Brand green — CTAs, active states, links |
| `--accent`    | `#c4722a` | Warning values (wind, visibility)        |
| `--danger`    | `#8b2e2e` | Danger/avoid states                      |
| `--warn`      | `#7a5c1e` | Caution states                           |
| `--safe`      | `#2d4a3e` | Go/good states                           |

### Typography

| Role               | Font                            | Weight        | Size            |
| ------------------ | ------------------------------- | ------------- | --------------- |
| Display / headings | Playfair Display (Google Fonts) | 400, 600, 700 | 18–58px (clamp) |
| Monospace labels   | DM Mono (Google Fonts)          | 300, 400, 500 | 9–13px          |
| Body / UI          | DM Sans (Google Fonts)          | 300, 400, 500 | 12–15px         |

### Background

A topographic grid pattern is applied as a CSS `repeating-linear-gradient` on `body::before`, with 40px spacing and ~12% opacity. A mountain silhouette SVG is fixed to the bottom of the viewport at 6% opacity.

---

## 14. Key implementation notes for Lovable

- The live bulletin preview card (`LivePreview`) fetches `/api/preview` client-side on mount and renders a shimmer skeleton while loading. It must handle three states: loading, error (with fallback link to whiterisk.ch), and loaded.
- The `bulletin_previews` table must be seeded before launch by triggering `/api/cron/send` once manually.
- The `unsubscribe_token` serves dual purpose — it is used for both email confirmation and unsubscribe links. This is intentional: once confirmed, the same token in the footer of every email acts as the unsubscribe mechanism.
- Subscribers are never hard-deleted except via the unsubscribe flow. There is no admin interface.
- The cron endpoint is idempotent — running it twice in the same slot will send duplicate emails to subscribers who received one in the first run. If deduplication is needed, check `send_log` before sending.
- The SLF bulletin text is passed raw to Claude. No pre-processing or parsing is done. Claude is expected to extract weather values from the narrative text, which it does reliably for this domain.

---

## 15. Maintenance commands

### 15.1 Trigger the poller manually

Fetches the current SLF bulletin, deduplicates against existing rows, runs Claude summarisation on any new zones, and stores results.

```bash
# Development (auth bypassed when NODE_ENV=development)
curl http://localhost:3000/poller/api/run

# Production (requires CRON_SECRET)
curl -H "Authorization: Bearer $CRON_SECRET" https://snowdesk.info/poller/api/run
```

### 15.2 Regenerate summaries

`POST /poller/api/regenerate` re-runs Claude summarisation and writes the result back to the `summary` column.

**Regenerate all bulletins with an empty summary** (default behaviour — skips rows that already have a non-empty summary):

```bash
# Development
curl -X POST http://localhost:3000/poller/api/regenerate

# Production
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://snowdesk.info/poller/api/regenerate
```

**Force-regenerate all bulletins**, including those that already have a summary:

```bash
curl -X POST "http://localhost:3000/poller/api/regenerate?force=true"
```

**Regenerate a single bulletin by ID:**

```bash
curl -X POST http://localhost:3000/poller/api/regenerate \
  -H "Content-Type: application/json" \
  -d '{ "bulletinId": "<uuid>" }'
```

**Combine — force-regenerate a single bulletin:**

```bash
curl -X POST "http://localhost:3000/poller/api/regenerate?force=true" \
  -H "Content-Type: application/json" \
  -d '{ "bulletinId": "<uuid>" }'
```

### 15.3 Inspect stored bulletins

Use Prisma Studio or a direct SQL query to inspect the `Bulletin` table.

```bash
# Open Prisma Studio (browser UI at http://localhost:5555)
npx prisma studio

# Check how many bulletins have an empty summary
psql $DATABASE_URL -c "SELECT count(*) FROM \"Bulletin\" WHERE summary = '{}'::jsonb;"

# List the most recent 10 bulletins with their zone IDs and issued timestamps
psql $DATABASE_URL -c "
  SELECT \"bulletinId\", \"issuedAt\", \"nextUpdate\",
         array_length(\"regionNames\", 1) AS region_count
  FROM \"Bulletin\"
  ORDER BY \"issuedAt\" DESC NULLS LAST
  LIMIT 10;
"

# Find bulletins for a specific region name (case-insensitive)
psql $DATABASE_URL -c "
  SELECT \"bulletinId\", \"issuedAt\", \"regionNames\"
  FROM \"Bulletin\"
  WHERE \"regionNames\" && ARRAY['Davos']
  ORDER BY \"issuedAt\" DESC;
"
```

### 15.4 Clear all bulletins (destructive)

Only use this to reset the database during development or to force a full re-fetch.

```bash
psql $DATABASE_URL -c 'TRUNCATE TABLE "Bulletin" CASCADE;'
```

After truncating, re-run the poller (`/poller/api/run`) to repopulate from the live SLF feed.
