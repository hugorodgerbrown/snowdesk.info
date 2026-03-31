# CLAUDE.md — Snowdesk Development Guide

## Project Overview

Snowdesk is a Vercel Services application that polls the Swiss avalanche authority (SLF) bulletin API twice daily, analyzes bulletins with Claude AI, and displays structured forecasts on a public Next.js web app.

- **Monorepo**: Two npm workspaces — `web` (public site) and `poller` (background tasks)
- **Deployment**: Vercel Services with route-based splitting (`/` for web, `/poller` for poller)
- **Database**: Supabase (PostgreSQL) with Prisma ORM
- **Runtime**: Node.js 20+

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript |
| Backend | Next.js API routes, Prisma 7.6.0 |
| Database | Supabase PostgreSQL, pg driver |
| AI | Anthropic Claude API (Sonnet 4) |
| Email | Resend |
| CSS | CSS custom properties (no framework) |

**Not configured**: ESLint, Prettier, Jest/Vitest, pre-commit hooks.

## Project Structure

```
snowdesk.info/
├── web/                          # Public Next.js app (route prefix: /)
│   ├── app/
│   │   ├── page.tsx             # Home: redirects to random zone
│   │   ├── [zone]/page.tsx      # Zone-specific bulletin display
│   │   ├── bulletin-view.tsx    # Reusable bulletin render component
│   │   ├── slug.ts              # Slugification utility
│   │   ├── layout.tsx           # Root layout with Google Fonts
│   │   └── globals.css          # Design tokens, grid, mountain silhouette
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── poller/                       # Background Next.js app (route prefix: /poller)
│   ├── app/
│   │   ├── api/
│   │   │   ├── run/route.ts     # GET /poller/api/run — cron endpoint
│   │   │   └── regenerate/route.ts  # POST — re-analyze stored bulletins
│   │   └── lib/
│   │       ├── analyse-bulletin.ts      # Claude API + Zod validation
│   │       ├── bulletin-schema.ts       # Zod schema for BulletinAnalysis
│   │       ├── bulletin-constants.ts    # System prompt, model, max tokens
│   │       ├── bulletin-prompt.ts       # User prompt builder + HTML stripper
│   │       ├── to-display-summary.ts    # Schema → display format transform
│   │       └── html.ts                  # HTML utilities
│   ├── next.config.ts           # basePath: /poller
│   ├── package.json
│   └── tsconfig.json
│
├── prisma/
│   ├── schema.prisma            # Single Bulletin model (JSONB summary + rawData)
│   └── migrations/
│
├── package.json                 # Root workspace manifest
├── prisma.config.ts             # Prisma config + dotenv loader
├── vercel.json                  # Vercel Services + cron schedule
├── specification.md             # Full technical spec
├── bulletin_analysis_prompt.md  # Claude prompt documentation
└── sample_raw_4116.json         # Example SLF GeoJSON feature
```

## Build & Dev Commands

```bash
# Install dependencies
npm install

# Local development (runs both web and poller)
vercel dev -L

# Build both workspaces
npm run build

# Workspace-specific
npm run --workspace=web dev
npm run --workspace=poller dev

# Database
npx prisma migrate dev          # Apply migrations
npx prisma db push              # Push schema to Supabase
npx prisma studio               # Visual DB explorer at localhost:5555

# Test poller locally (auth skipped in development)
curl http://localhost:3000/poller/api/run

# Regenerate all summaries
curl -X POST "http://localhost:3000/poller/api/regenerate?force=true"
```

## Environment Variables

Create `.env.local` from `.env.example`:

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Vercel cron job auth token |
| `EXTERNAL_API_URL` | SLF bulletin API endpoint |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_FROM_EMAIL` | Sender email address |

Pull from Vercel: `vercel env pull .env.local`

## Code Conventions

### Naming
- **Files**: lowercase with hyphens (`analyse-bulletin.ts`, `bulletin-view.tsx`)
- **Components**: PascalCase (`BulletinView`)
- **Functions/variables**: camelCase
- **Types/interfaces**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE

### Module Headers
Every module has a header comment explaining its purpose:
```typescript
// lib/analyse-bulletin.ts
//
// Sends an SLF bulletin to Claude for analysis and returns a validated
// BulletinAnalysis object. Retries once on parse/validation failure.
```

### Error Handling
- Custom error classes for domain errors (e.g., `BulletinAnalysisError`)
- Console logs with `[COMPONENT]` prefixes: `console.log("[POLLER] Starting...")`
- Try-catch in async route handlers with appropriate HTTP status codes

### TypeScript
- Strict mode enabled
- Zod validation for Claude API responses at runtime
- Explicit types for function parameters and return values

### CSS & Design
- All colors/fonts as CSS custom properties in `web/app/globals.css`
- Inline styles via `React.CSSProperties` objects
- Responsive sizing via CSS `clamp()`
- Key tokens: `--cream`, `--ink`, `--alpine` (brand green), `--danger`
- Fonts: Playfair Display (display), DM Sans (body), DM Mono (mono)

### Database
- Single `Bulletin` model storing raw SLF GeoJSON + Claude analysis as JSONB
- PrismaPg adapter for serverless connection pooling

## Key Data Pipeline

1. **Fetch** SLF GeoJSON from external API
2. **Strip HTML** from comment fields
3. **Build prompt** with structured SLF data + region context
4. **Call Claude** with system prompt + user message
5. **Validate** JSON response with Zod schema (1 retry on failure)
6. **Store** raw GeoJSON + validated summary in Supabase
7. **Display** via `BulletinView` component

## Deployment

Vercel Services with two cron jobs:
- `0 7 * * *` (07:00 UTC) — morning bulletin
- `0 16 * * *` (16:00 UTC) — afternoon bulletin

Both hit `GET /poller/api/run`.

## Common Tasks

### Add a new bulletin field
1. Update Zod schema in `poller/app/lib/bulletin-schema.ts`
2. Update system prompt in `poller/app/lib/bulletin-constants.ts`
3. Update `BulletinView` in `web/app/bulletin-view.tsx` to render it
4. Regenerate existing summaries via `/poller/api/regenerate?force=true`

### Modify Claude's analysis
1. Edit system prompt in `bulletin-constants.ts`
2. Edit user message in `bulletin-prompt.ts`
3. Update Zod schema if output shape changes
4. Test locally: `curl http://localhost:3000/poller/api/run`

### Add a new API route
1. Create `poller/app/api/[name]/route.ts`
2. Export `GET`/`POST` handlers
3. Use Prisma: `const prisma = new PrismaClient({ adapter })`
4. Return `Response.json(data)` or `new Response(..., { status })`

## Reference Documentation

- `specification.md` — Full technical spec (database schema, API details, regions)
- `bulletin_analysis_prompt.md` — Claude prompt templates with examples
- `sample_raw_4116.json` — Example SLF GeoJSON for Haut Val de Bagnes
