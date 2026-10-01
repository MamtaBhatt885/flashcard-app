# Reflection – Lab 5: Flashcard Study App

## What I built

A full-stack flashcard app with spaced repetition. It has a React + Vite frontend, a Node/Express REST API, and Prisma with SQLite for the database. Both apps share one package of Zod schemas that acts as the contract between them. Users can sign up, create decks, add cards, and study with flip cards. Correct and incorrect answers feed into the SM-2 scheduling algorithm, and each session ends with a summary. The project has unit tests (Vitest), integration tests (Supertest against a test SQLite database) and end-to-end tests (Playwright).

## How I used AI

I worked through the lab as a sequence of prompts:

- **Architecture:** project structure, architectural rationale, scaffold review.
- **Components:** DeckCard, DeckList, DeckForm, StudySession.
- **Backend:** Prisma schema, REST endpoints.
- **Review prompts:** N+1 / over-fetching / mass assignment, "where did you use a generic but weak pattern?", the shared contract, and the mismatch hunt.
- **Testing:** unit, integration, E2E, and a critique of the tests.

Each prompt built on the code from the previous one. I learned to give specific constraints in the prompt (for example "controlled inputs, validated with the shared Zod schema, with labeled fields", or "useReducer in a custom hook"). That gave much better results than vague requests.

## What AI did well

- **Speed on structure and boilerplate.** The monorepo layout, the routes → controllers → services → repositories layering, and the first versions of the components came together quickly and were consistent with each other.
- **Explaining its decisions.** Asking for the architectural rationale *before* writing code helped me understand why the frontend, backend and shared contract were split the way they were.
- **Finding problems when asked directly.** The review prompts were the most valuable part of the lab. When I asked AI to look for N+1 queries, mass assignment, and frontend/backend mismatches, it found real issues in code it had written itself.

## Where AI fell short, and what I had to correct

- **The first version was not the best version.** The "generic but weak pattern" prompt showed the AI had used shortcuts the first time. Examples:
  - Casting API responses with `as T` instead of validating them.
  - A spaced-repetition formula that could trap cards at a low ease forever ("ease hell").
  
  The code worked, but it wasn't robust until I asked it to look again.
- **Contract drift.** Even with a shared schema package, the mismatch hunt found real differences between frontend and backend:
  - A blank description came back as `""` in one case and `null` in another.
  - Some error messages and status codes didn't match what the UI expected.
  - A 401 wasn't handled for mutations.
- **Concurrency bugs that only tests revealed.** The first database rate limiter let 20 out of 20 simultaneous login attempts through, because it read and then wrote in two steps. It only became correct after an integration test hammered it with parallel requests and the code was changed to one atomic SQL statement.
- **Environment problems.** Docker Desktop wouldn't open on my Mac, so we switched from PostgreSQL to Postgres.app and finally to SQLite. Some package versions also had to be pinned:
  - npm's "latest" Prisma was a release candidate.
  - The newest TypeScript wasn't supported by the linter.
  
  AI couldn't know my machine's setup without me sending screenshots and error messages.
- **Things it forgot.** The project had a `lint` script and a pre-commit hook from the start, but no ESLint config file, so linting never actually worked. This was only noticed at the end.

## What testing taught me

- **Different levels catch different bugs.**
  - Unit tests checked the study reducer and Zod schemas in milliseconds.
  - Integration tests caught wrong status codes, ownership leaks (one user seeing another's deck) and race conditions.
  - E2E tests proved the whole flow works in a real browser: create a deck, add cards, study, check the summary.
- **A flaky test can be a real bug.** The "phone-sized screen" E2E test failed about one run in three. It looked like test flakiness, but the cause was a real layout bug: a deck with a long title made the card wider than a phone screen. Fixing the CSS (`min-w-0` and `grid-cols-1`) made the test pass 8 out of 8 times.
- **The critique prompt mattered.** The first tests mostly covered the happy path. Asking "which important cases are missing?" added:
  - expired and forged login tokens
  - rate limits surviving a restart
  - SM-2 behavior across several days
  - double submits and concurrent requests
  - keyboard-only study
  - the delete confirmation dialog
  
  These are the cases most likely to break in real use.

## What I would do differently

- Ask for tests **alongside** each feature instead of at the end, so bugs like the rate-limiter race are caught immediately.
- Set up lint, formatting and git on day one and commit after every prompt, so I can see exactly what each prompt changed.
- Always review AI output with a second, critical prompt ("what's weak here?"), because the first answer is usually *working*, not *good*.
- One known limitation remains. The "at most two answers per card per session" rule is enforced by a count-then-insert in application code. Under extreme load it could still be bypassed. The proper fix is a database unique constraint.

## Key takeaway

AI made me much faster, but it didn't replace judgment. The biggest improvements came from **reviewing, questioning and testing** the AI's code, not from the first generation. A shared contract plus tests at every level is what turned "it seems to work" into "I can show it works."
