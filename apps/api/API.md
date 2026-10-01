# Flashcards REST API

All routes are under `/api`. Everything except `/auth/*` and `/health` needs the auth cookie (401 without it).
Request and response bodies are JSON. Errors are `{ "message": string, "details"?: { field: string[] } }`.

**Layers:** `*.routes.ts` (URL → controller) → `*.controller.ts` (parses params/body with Zod into typed values, picks status codes) → `*.service.ts` (rules, 404/409) → `*.repository.ts` (Prisma only).
Request bodies are validated with the shared Zod schemas in `packages/shared`. They're **strict**: unknown fields (e.g. `userId`, `dueAt`) get a 400, never written. Ids in the URL must be UUIDs.

**Responses are contract-checked on both ends.** Controllers send only through `sendJson(res, schema, data)`, which parses the data with the shared response schema (`packages/shared/src/responses.ts`) first: fields outside the contract are stripped (nothing leaks), and a response that breaks it becomes a logged 500 instead of bad data. The web app parses every response again with the same schemas.

## Status codes

| Code | When |
|---|---|
| 200 | Read or update succeeded |
| 201 | Created (with a `Location` header pointing at the new resource) |
| 204 | Deleted (no body) |
| 400 | Invalid body, malformed JSON, or malformed id in the URL |
| 401 | Not signed in / session expired |
| 404 | Doesn't exist **or belongs to another user** (never reveals someone else's data exists) |
| 409 | Conflict: duplicate deck title, duplicate email, answering a finished session, answering a card a 3rd time or one that wasn't due |
| 429 | Too many login/signup attempts (counted per IP in the `RateLimit` table, so limits survive restarts) |
| 500 | Server bug, including a response that failed its own contract (details only in dev and in the server log) |

## Decks

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/decks` | – | 200 `DeckSummary[]` | – |
| POST | `/decks` | `{ title, description? }` | 201 `DeckDetail` | 400, 409 |
| GET | `/decks/:deckId` | – | 200 `DeckDetail` (with cards) | 400, 404 |
| PUT | `/decks/:deckId` | `{ title, description? }` | 200 `DeckSummary` (counts, no card list) | 400, 404, 409 |
| DELETE | `/decks/:deckId` | – | 204 (cascades to cards, sessions, answers) | 400, 404 |

## Cards

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/decks/:deckId/cards` | – | 200 `Card[]` | 400, 404 |
| POST | `/decks/:deckId/cards` | `{ front, back }` | 201 `Card` | 400, 404 |
| GET | `/cards/:cardId` | – | 200 `Card` | 400, 404 |
| PUT | `/cards/:cardId` | `{ front, back }` | 200 `Card` | 400, 404 |
| DELETE | `/cards/:cardId` | – | 204 | 400, 404 |

## Study sessions

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/decks/:deckId/sessions` | `{ practice?: boolean, cardIds?: uuid[] }` | 201 `{ session, cards }`, or 200 `{ session: null, cards: [] }` when nothing is due | 400, 404 |
| GET | `/decks/:deckId/sessions` | – | 200 `SessionSummary[]` (latest 20) | 400, 404 |
| GET | `/sessions/:sessionId` | – | 200 `SessionDetail` (with answers) | 400, 404 |
| POST | `/sessions/:sessionId/answers` | `{ cardId, correct }` | 201 `{ answer, card }` | 400, 404, 409 |
| POST | `/sessions/:sessionId/complete` | `{ skipped }` (≤ cards in session) | 200 `SessionDetail` (idempotent) | 400, 404 |

Answer rules (so replayed requests can't game the scheduler):
- Only the **first** answer to a card in a session reschedules it with SM-2 (Correct = quality 5, Incorrect = 1, ease capped at 2.5 so it can recover after a miss).
- A card can be answered at most **twice** per session (first try + one retry after a miss); a 3rd answer gets 409.
- In a normal session the card must have been due when the session started (409 otherwise).
- Practice sessions (`practice: true`, `cardIds` required, no duplicates, all from this deck) never reschedule.

## Query budget

Every endpoint runs a fixed number of queries regardless of data size (no N+1). Set `LOG_QUERIES=true` in `apps/api/.env` to print each SQL statement.

| Endpoint | Queries |
|---|---|
| `GET /decks` | 2 (decks with card counts + one GROUP BY for due counts) |
| `GET /decks/:id/sessions` | 3 (ownership + sessions + one GROUP BY for answer counts) |
| `POST /decks` | 1 (insert; the unique constraint detects duplicates → 409) |
| `PUT /cards/:id`, `DELETE /cards/:id`, `DELETE /decks/:id` | 1 (ownership checked inside the same statement) |

## Auth

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/auth/signup` | `{ email, password }` | 201 `User` + cookie | 400, 409, 429 |
| POST | `/auth/login` | `{ email, password }` | 200 `User` + cookie | 400, 401, 429 |
| POST | `/auth/logout` | – | 204 | – |
| GET | `/auth/me` | – | 200 `User` | 401 |
