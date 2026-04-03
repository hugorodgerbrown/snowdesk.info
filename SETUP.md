# Local Development Setup

## Prerequisites

Install the following:

1. **Node.js 20+** — download from https://nodejs.org or use a version manager like `nvm`
2. **Docker** — needed to run a local PostgreSQL database
3. **Vercel CLI** — `npm install -g vercel`
4. **Git** — likely already installed; check with `git --version`

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

## 3. Start a local PostgreSQL database

The simplest way is with Docker:

```bash
docker run --name snowdesk-db \
  -e POSTGRES_USER=snowdesk \
  -e POSTGRES_PASSWORD=snowdesk \
  -e POSTGRES_DB=snowdesk \
  -p 5432:5432 \
  -d postgres:16
```

This starts a PostgreSQL 16 instance on `localhost:5432`.

To stop/start it later:

```bash
docker stop snowdesk-db
docker start snowdesk-db
```

## 4. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Local database (matches the Docker command above)
DATABASE_URL=postgresql://snowdesk:snowdesk@localhost:5432/snowdesk

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

Then override `DATABASE_URL` with the local Docker one above.

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
Check that the Docker container is running: `docker ps`. The database takes a second or two to be ready after starting.

**Port 5432 already in use**
Another PostgreSQL instance is running. Either stop it or change the Docker port mapping (e.g., `-p 5433:5432`) and update `DATABASE_URL` accordingly.

**Port 3000 already in use**
Another dev server is running. Stop it or use `vercel dev -L --listen 3001`.
