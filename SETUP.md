# Local Development Setup

## Prerequisites

Install the following:

1. **Node.js 20+** — download from https://nodejs.org or use a version manager like `nvm`
2. **Supabase CLI** — manages the local database
3. **Vercel CLI** — `npm install -g vercel`
4. **Git** — likely already installed; check with `git --version`

### Install the Supabase CLI

On macOS:

```bash
brew install supabase/tap/supabase
```

On Linux:

```bash
brew install supabase/tap/supabase
```

On Windows (via scoop):

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Or install via npm (any platform):

```bash
npm install -g supabase
```

Verify with:

```bash
supabase --version
```

The Supabase CLI uses Docker under the hood, so make sure **Docker** is installed and running.

## 1. Clone the repo

```bash
git clone git@github.com:hugorodgerbrown/snowdesk.info.git
cd snowdesk.info
```

## 2. Install dependencies

```bash
npm install
```

This installs both the `web` and `poller` workspaces.

## 3. Start a local Supabase database

Initialize Supabase (first time only):

```bash
supabase init
```

Start the local Supabase stack:

```bash
supabase start
```

This spins up a local PostgreSQL database (and other Supabase services) via Docker. Once started, it prints the connection details — you'll need the `DB URL` for the next step.

The local database runs on `localhost:54322` by default.

To stop/start later:

```bash
supabase stop
supabase start
```

To check status:

```bash
supabase status
```

## 4. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Local Supabase database (printed by `supabase status` as "DB URL")
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Get from team or Vercel dashboard
CRON_SECRET=any-local-secret
EXTERNAL_API_URL=<ask a team member for the SLF endpoint>
ANTHROPIC_API_KEY=<your Anthropic API key>

# Optional — only needed if testing email
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

If you have access to the Vercel project, you can pull env vars directly:

```bash
vercel env pull .env.local
```

Then override `DATABASE_URL` with the local Supabase one above.

## 5. Set up the database schema

Run Prisma migrations to create the tables:

```bash
npx prisma migrate dev
```

To explore the database visually:

```bash
npx prisma studio
```

This opens a browser UI at http://localhost:5555.

## 6. Run the app

```bash
vercel dev -L
```

This starts both workspaces:

- **Web app** — http://localhost:3000
- **Poller API** — http://localhost:3000/poller/api/run

To run a single workspace instead:

```bash
npm run --workspace=web dev      # just the web app
npm run --workspace=poller dev   # just the poller
```

## 7. Test the poller

Trigger a bulletin fetch locally (auth is skipped in development):

```bash
curl http://localhost:3000/poller/api/run
```

## Linting & formatting

```bash
npm run lint          # check for issues
npm run lint:fix      # auto-fix issues
npm run format        # format all files
npm run format:check  # check formatting without changing files
```

Pre-commit hooks (Husky + lint-staged) run automatically on `git commit`.

## Troubleshooting

**`prisma migrate dev` fails with connection error**
Check that Supabase is running: `supabase status`. If not, run `supabase start`.

**Port 54322 already in use**
Another Supabase or PostgreSQL instance may be running. Stop it or check with `docker ps`.

**Port 3000 already in use**
Another dev server is running. Stop it or use `vercel dev -L --listen 3001`.
