# Snowdesk — Avalanche Bulletin Poller

A Vercel Services app that polls SLF (Swiss Avalanche Authority) avalanche bulletins, summarizes them with Claude AI, stores them in Supabase, and displays them on a public web app.

## Architecture

```
┌─ web/              ← Public Next.js app (📍 /  )
│  └─ app/page.tsx   ← Displays latest bulletin + raw data
│
└─ poller/           ← Background Next.js app (📍 /poller )
   └─ api/run/       ← Cron endpoint (every 5 min)
      1. Fetch raw bulletin from SLF API
      2. Summarize with Claude AI
      3. Store in Supabase (rawData + summary)
      4. Send email notifications via Resend
```

## Setup

### 1. Link Supabase to Vercel

```bash
vercel integration add supabase
# Accept terms in terminal, choose team, create new project or link existing
```

This auto-provisions `DATABASE_URL` in Vercel. Then:

```bash
vercel env pull .env.local
```

### 2. Get API Keys

**Claude API:**
- Go to https://console.anthropic.com
- Create a key, add to Vercel dashboard as `ANTHROPIC_API_KEY`

**Resend (Email):**
```bash
vercel integration add resend
```
This auto-provisions `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

**SLF Bulletin API:**
- Update `EXTERNAL_API_URL` with the actual SLF endpoint (see below)

### 3. Set Up Database

```bash
npm install --workspace=. @prisma/client prisma
npx prisma migrate dev --name init
# or: npx prisma db push  (if using Supabase)
```

### 4. Configure Environment

Update `.env.development.local`:

```env
CRON_SECRET=<your-secret-from-earlier>
EXTERNAL_API_URL=https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/current-avalanche-bulletin/
DATABASE_URL=<from-vercel-env-pull>
ANTHROPIC_API_KEY=<from-anthropic>
RESEND_API_KEY=<from-resend>
RESEND_FROM_EMAIL=noreply@snowdesk.info
```

Then pull into production:

```bash
vercel env add ANTHROPIC_API_KEY production
# Paste your API key, then:
vercel env pull .env.local
```

### 5. Run Locally

```bash
npm install
vercel dev -L
```

This runs both `web` (port 3000) and `poller` (route prefix `/poller`) together.

Test the poller manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/poller/api/run
```

## Data Model

### Bulletin

Stores one avalanche bulletin per issue time.

```javascript
{
  id: "...",
  rawData: { /* raw JSON from SLF */ },
  summary: {
    headline: "Moderate avalanche danger above 2400m",
    overview: "...",
    dangerLevels: [
      { region: "North", level: 3, description: "..." }
    ],
    mainProblems: [
      { type: "wind-slab", description: "...", elevation: "Above 2400m", aspect: "N, NE, E" }
    ],
    travelRecommendations: "- Avoid wind-loaded slopes...",
    issueTime: "2026-03-30T07:00:00Z",
    validUntil: "2026-03-31T07:00:00Z"
  },
  issuedAt: "2026-03-30T07:00:00Z",
  validFrom: "2026-03-30T08:15:00Z",
  validTo: "2026-03-31T07:00:00Z",
  fetchedAt: "2026-03-30T08:15:00Z",
  regions: [
    { id: "...", bulletinId: "...", regionCode: "north", regionName: "North", dangerLevel: 3, rawData: {...} }
  ]
}
```

### EmailNotification

Tracks which recipients have been notified.

```javascript
{
  id: "...",
  bulletinId: "...",
  recipient: "user@example.com",
  status: "sent|failed|pending",
  sentAt: "2026-03-30T08:16:00Z",
  error: null
}
```

## Poller Flow

1. **Fetch** → `EXTERNAL_API_URL` → raw JSON
2. **Summarize** → Claude (Opus 4.6) → structured summary
3. **Store** → Supabase Bulletin + BulletinRegion + EmailNotification
4. **Email** → Resend to configured recipients
5. **Return** → 200 OK with `bulletinId` and timestamp

## Display Component

`web/app/page.tsx` fetches the latest bulletin and displays:

- Headline + overview
- Danger levels by region (color-coded)
- Main problems + travel recommendations
- Raw data in a details/summary collapsible

## Cron Schedule

Defined in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/poller/api/run",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Runs every 5 minutes on **Pro** plan. (Hobby plan: max once per day.)

## Troubleshooting

**Poller returns 401:**
- Check `CRON_SECRET` matches env var
- Verify Vercel injects auth header correctly

**Database connection fails:**
- Run `vercel env pull .env.local` again
- Check Supabase project is active

**Claude summarization fails:**
- Verify `ANTHROPIC_API_KEY` is set in Vercel
- Check Claude API rate limits

**Email not sent:**
- Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set
- Add recipients to the email logic (currently empty — configure in code or env)

## Next Steps

1. Get the **actual SLF API endpoint** and update `EXTERNAL_API_URL`
2. **Configure email recipients** in the poller (currently no-op)
3. **Deploy** to Vercel: `vercel --prod`
4. **Monitor** cron logs: `vercel logs --follow`

## Resources

- [SLF Avalanche Bulletin](https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/)
- [Vercel Services](https://vercel.com/docs/services)
- [Prisma](https://www.prisma.io/docs/)
- [Claude API](https://docs.anthropic.com/en/docs/about-claude/models/latest)
- [Resend](https://resend.com/docs)
