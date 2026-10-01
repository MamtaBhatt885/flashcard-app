# Flashcard Study App

A full-stack flashcard app with spaced repetition. You can create decks, add cards, and study them. Cards you get right come back later, and cards you miss come back sooner (the SM-2 algorithm).

**Stack:** React 19 + Vite + TanStack Query + Tailwind (frontend) · Node.js + Express 5 + Prisma 7 + SQLite (backend) · Zod schemas shared by both · Vitest, Supertest and Playwright (tests).

## Features

- Sign up / sign in. The session is kept in an httpOnly cookie, and login attempts are rate-limited.
- Create, edit and delete decks, with a confirm dialog before deleting.
- Add, edit and delete cards in a deck.
- Study mode:
  - flip cards, then mark them Correct / Incorrect (or skip)
  - a progress bar
  - a missed card comes back once at the end of the session
  - an end-of-session summary, with a "practice missed cards" option
- Keyboard shortcuts while studying: **Space/Enter** flips, **←** or **1** marks Incorrect, **→** or **2** marks Correct, **S** skips.
- Every request and response is checked against one shared contract (see [CONTRACT.md](CONTRACT.md)).

## Project structure

```
lab5/
├── packages/shared/      Zod schemas + TypeScript types used by BOTH apps (the API contract)
├── apps/api/             Express REST API
│   ├── prisma/           schema.prisma, migrations, seed script
│   ├── src/modules/      auth, decks, cards, sessions (routes → controllers → services → repositories)
│   └── test/             Supertest integration tests
├── apps/web/             React frontend
│   ├── src/features/     auth, decks, cards, study (api calls, hooks, components)
│   ├── src/pages/        one component per route
│   └── e2e/              Playwright end-to-end tests
├── CONTRACT.md           data structures shared by frontend and backend
└── apps/api/API.md       endpoint reference
```

## Getting started

**Requirements:** Node.js 22.12 or newer, and npm.

```bash
# 1. Install dependencies for all packages
npm install

# 2. Create the API's settings file, then set JWT_SECRET to a long random value
cp apps/api/.env.example apps/api/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Create the database, generate the Prisma client and add demo data
npm run setup

# 4. Start everything (shared package, API on :4000, web on :5173)
npm run dev
```

Open **http://localhost:5173** and sign in with the demo account **demo@example.com / password123**, or sign up for a new one.

> Already set up? Just run `npm run dev`. After pulling new migrations, run `npm run db:migrate`.

## Scripts (run from the project root)

| Command | What it does |
|---|---|
| `npm run dev` | Start the shared package, API and web app together |
| `npm run build` | Build all three packages |
| `npm test` | Run unit and integration tests in every package |
| `npm run test:e2e` | Run the Playwright browser tests |
| `npm run lint` | Check code with ESLint |
| `npm run typecheck` | Check types in every package |
| `npm run format` | Format code with Prettier |
| `npm run db:migrate` | Apply / create database migrations |
| `npm run db:seed` | Reset the demo account and its starter deck |

## Testing

| Kind | Tool | What it covers | Command |
|---|---|---|---|
| Unit | Vitest | Zod schemas, study reducer, DeckForm, error helpers, SM-2 | `npm test -w packages/shared`<br>`npm test -w apps/web`<br>`npm run test:unit -w apps/api` |
| Integration | Vitest + Supertest | Every API endpoint against a real SQLite test database (`test.db`) | `npm run test:integration -w apps/api` |
| End-to-end | Playwright | The full app in a real browser: sign up, create a deck, add cards, study, check the summary | `npm run test:e2e` |

- Test databases (`test.db`, `e2e.db`) are rebuilt from the migrations on every run, so your `dev.db` is never touched.
- The first time you run E2E tests, install the browser with `npx playwright install chromium`.
- To watch the browser while the tests run: `cd apps/web && npx playwright test --headed`.

## Configuration

| File | Purpose |
|---|---|
| `apps/api/.env` | API settings: port, database file, JWT secret, CORS origin, rate limits. Copy from `.env.example`. **Never commit it.** |
| `apps/web/.env.local` | Optional frontend overrides, e.g. `VITE_API_BASE_URL`. Copy from `apps/web/.env.example`. |

In development, the web app calls `/api`, and Vite forwards those calls to the API on port 4000.

## API

The REST API lives under `/api`:

- **Auth:** `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/me`
- **Decks:** `/decks`, `/decks/:deckId`
- **Cards:** `/decks/:deckId/cards`, `/cards/:cardId`
- **Study sessions:** `/decks/:deckId/sessions`, `/sessions/:id`, `/sessions/:id/answers`, `/sessions/:id/complete`

See **[apps/api/API.md](apps/api/API.md)** for every endpoint and status code, and **[CONTRACT.md](CONTRACT.md)** for the data structures.
# flashcard-app
# flashcard-app
