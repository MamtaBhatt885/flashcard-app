# Flashcards API Contract

This document defines every data structure that travels between the **frontend** (`apps/web`) and the **backend** (`apps/api`).

The contract is not only written down here. It is **code**, in the shared package `packages/shared`, and both sides import it:

| File | Defines |
|---|---|
| `packages/shared/src/schemas.ts` | **Request** bodies (what the web app sends) + limits |
| `packages/shared/src/responses.ts` | **Response** bodies (what the API sends back) + the error format |
| `packages/shared/src/index.ts` | Re-exports both, imported as `@flashcards/shared` |

Each schema is a Zod schema, and each TypeScript type is generated from it with `z.infer`. So the runtime check and the compile-time type can never disagree. If this document and the code ever differ, **the code wins**, and this document should be updated.

```
          packages/shared  (Zod schemas + TS types)
             ▲                         ▲
   imports   │                         │   imports
             │                         │
 apps/web ── request (JSON) ──────────► apps/api
          ◄── response (JSON) ──────────
   parses every response          parses every request body
   with the shared schema         and every response before sending
```

---

## 1. Rules that apply everywhere

| Rule | Detail |
|---|---|
| Format | JSON, `Content-Type: application/json`, max request body 100 kb |
| Field names | **camelCase** on the wire, the same as in code (`deckId`, `dueAt`, `cardCount`) |
| IDs | UUID strings (UUIDv7, time-ordered), e.g. `"0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1b"` |
| Dates | **ISO 8601 UTC strings** from `toISOString()`, e.g. `"2026-09-30T07:03:51.111Z"`. Never Date objects or numbers |
| Counts | Non-negative integers |
| "No value" | Response fields use **`null`** (key always present). Optional request fields may be **omitted** |
| Requests are strict | Unknown fields (e.g. `userId`, `dueAt`) are rejected with **400**, never silently saved |
| Responses are not strict | The API may add new fields later without breaking older clients; the web app strips unknown fields |
| Auth | httpOnly cookie set by `/auth/login` or `/auth/signup`. Every route except `/auth/*` and `/health` needs it |
| Base URL | `/api` (the web app reads `VITE_API_BASE_URL`, default `/api`) |

---

## 2. Data structures (responses)

Defined in `responses.ts`. Fields marked `| null` are always present but may be `null`.

### User
```ts
type User = {
  id: string;      // uuid
  email: string;   // lowercase
};
```
The password hash is never sent.

### Card
```ts
type Card = {
  id: string;          // uuid
  deckId: string;      // uuid
  front: string;
  back: string;
  interval: number;    // int ≥ 0: days between reviews (SM-2)
  repetitions: number; // int ≥ 0: correct answers in a row (SM-2)
  easeFactor: number;  // ≥ 1.3 (max 2.5): how fast intervals grow (SM-2)
  dueAt: string;       // ISO date: when the card is next due
};
```

### Deck, DeckSummary, DeckDetail
These build on each other. Each one adds fields to the previous one:
```ts
type Deck = {
  id: string;
  title: string;
  description: string | null;   // null when there is no description
  updatedAt: string;            // ISO date
};

type DeckSummary = Deck & {
  cardCount: number;            // all cards in the deck
  dueCount: number;             // cards due now
};

type DeckDetail = DeckSummary & {
  cards: Card[];
};
```

### StudySession, SessionAnswer, SessionSummary, SessionDetail
```ts
type StudySession = {
  id: string;
  deckId: string;
  practice: boolean;          // practice runs never change the schedule
  cardCount: number;          // cards queued when the session started
  skipped: number;
  startedAt: string;          // ISO date
  completedAt: string | null; // null while in progress
};

type SessionAnswer = {
  id: string;
  cardId: string;
  correct: boolean;
  answeredAt: string;         // ISO date
};

type SessionSummary = StudySession & { correct: number; incorrect: number };
type SessionDetail  = SessionSummary & { answers: SessionAnswer[] };

type StartSessionResponse = { session: StudySession | null; cards: Card[] };
type AnswerResponse       = { answer: SessionAnswer; card: Card };  // card = its new schedule
```

### ApiError (body of every 4xx / 5xx)
```ts
type ApiError = {
  message: string;                      // human-readable, safe to show in the UI
  details?: Record<string, string[]>;   // only on 400 validation errors, keyed by field
};
```
Examples:
```json
{ "message": "Title is required", "details": { "title": ["Title is required"] } }
{ "message": "You already have a deck named “Chemistry”" }
{ "message": "Deck not found" }
{ "message": "Too many attempts. Try again in 15 minutes." }
```

---

## 3. Request bodies

Defined in `schemas.ts`. Text is **trimmed** before validation. The limits are exported constants (`DECK_LIMITS`, `CARD_LIMITS`, `MAX_SESSION_CARDS`), so the form inputs and the API use the same numbers.

| Type | Fields | Rules |
|---|---|---|
| `CredentialsInput` | `email`, `password` | email trimmed and lowercased, valid, ≤ 254 chars; password 8–128 chars |
| `DeckInput` | `title`, `description?` | title 1–120 chars; description ≤ 500 chars; blank description = none (stored and returned as `null`) |
| `CardInput` | `front`, `back` | each 1–2000 chars |
| `StartSessionInput` | `practice?`, `cardIds?` | `practice` defaults to `false`. Practice **requires** `cardIds` (1–50 unique uuids); a normal session **must not** send `cardIds` |
| `AnswerInput` | `cardId`, `correct` | uuid, boolean |
| `CompleteSessionInput` | `skipped` | integer 0–50, and not more than the session's card count |

Example request bodies:
```json
POST /api/decks                  { "title": "Spanish Basics", "description": "Greetings" }
POST /api/decks/:deckId/cards    { "front": "hola", "back": "hello" }
POST /api/decks/:deckId/sessions { }                                   // normal session
POST /api/decks/:deckId/sessions { "practice": true, "cardIds": ["…"] } // practice missed cards
POST /api/sessions/:id/answers   { "cardId": "…", "correct": true }
POST /api/sessions/:id/complete  { "skipped": 0 }
```

---

## 4. Endpoint map: which schema goes where

| Method & path | Request body | Success response | Errors |
|---|---|---|---|
| `POST /auth/signup` | `CredentialsInput` | **201** `User` + cookie | 400, 409, 429 |
| `POST /auth/login` | `CredentialsInput` | **200** `User` + cookie | 400, 401, 429 |
| `POST /auth/logout` | – | **204** (no body) | – |
| `GET /auth/me` | – | **200** `User` | 401 |
| `GET /decks` | – | **200** `DeckSummary[]` (newest updated first) | 401 |
| `POST /decks` | `DeckInput` | **201** `DeckDetail` + `Location` header | 400, 409 |
| `GET /decks/:deckId` | – | **200** `DeckDetail` | 400, 404 |
| `PUT /decks/:deckId` | `DeckInput` | **200** `DeckSummary` | 400, 404, 409 |
| `DELETE /decks/:deckId` | – | **204** (deletes its cards and sessions too) | 400, 404 |
| `GET /decks/:deckId/cards` | – | **200** `Card[]` | 400, 404 |
| `POST /decks/:deckId/cards` | `CardInput` | **201** `Card` | 400, 404 |
| `GET /cards/:cardId` | – | **200** `Card` | 400, 404 |
| `PUT /cards/:cardId` | `CardInput` | **200** `Card` | 400, 404 |
| `DELETE /cards/:cardId` | – | **204** | 400, 404 |
| `POST /decks/:deckId/sessions` | `StartSessionInput` | **201** `StartSessionResponse`, or **200** `{ session: null, cards: [] }` when nothing is due | 400, 404 |
| `GET /decks/:deckId/sessions` | – | **200** `SessionSummary[]` (latest 20) | 400, 404 |
| `GET /sessions/:sessionId` | – | **200** `SessionDetail` | 400, 404 |
| `POST /sessions/:sessionId/answers` | `AnswerInput` | **201** `AnswerResponse` | 400, 404, 409 |
| `POST /sessions/:sessionId/complete` | `CompleteSessionInput` | **200** `SessionDetail` (safe to repeat) | 400, 404 |

All routes are prefixed with `/api`. Every error body is an `ApiError`.

### What each status code means

| Code | Meaning |
|---|---|
| 200 / 201 / 204 | OK / created / deleted (204 has **no body**) |
| 400 | Invalid body, malformed JSON, unknown field, or an id in the URL that isn't a uuid. `details` lists the fields |
| 401 | Not signed in, or the session expired (the web app sends you back to sign-in) |
| 404 | Doesn't exist **or belongs to another user** (never reveals that someone else's data exists) |
| 409 | Conflict: duplicate deck title or email, answering a finished session, a 3rd answer to the same card, or a card that wasn't due |
| 413 | Request body over 100 kb |
| 429 | Too many login/signup attempts |
| 500 | Server bug, including a response that failed its own contract (details only in the server log) |

---

## 5. How the contract is enforced

The contract is checked **at runtime on both ends**, not just by TypeScript:

| Where | How | If it fails |
|---|---|---|
| API, incoming | Controllers run `schema.parse(req.body)` and parse URL ids as uuids | **400** with `details` |
| API, outgoing | Controllers send only through `sendJson(res, schema, data)` (`apps/api/src/lib/respond.ts`), which parses the data first and strips anything outside the contract (e.g. `passwordHash`, `userId`) | Logged **500**, never bad data |
| Web, incoming | Services call `api(path, schema)` (`apps/web/src/lib/apiClient.ts`), which parses every response; `apiVoid` checks for an empty 204 | `ContractError` shown as an error state |
| Web, errors | Every error body is parsed with `apiErrorSchema` | Falls back to the HTTP status text |
| Web, forms | DeckForm, card and auth forms validate with the **same** request schemas before sending | Messages shown next to the fields |

---

## 6. Tests that guard the contract

| Test file | Checks |
|---|---|
| `packages/shared/src/schemas.test.ts` | Request schemas: limits, trimming, strict fields, practice rules |
| `apps/api/src/lib/respond.test.ts` | `sendJson` strips extra fields and turns contract violations into 500s |
| `apps/api/test/*.int.test.ts` | Every endpoint's status code, and every response body parsed with its shared schema |
| `apps/web/src/lib/services.contract.test.ts` | Every web service uses the right schema, and no code calls `fetch` outside `apiClient.ts` |
| `apps/web/e2e/*.spec.ts` | The full browser → API → database flow |

---

## 7. Changing the contract

1. Edit the schema in `packages/shared/src` (requests in `schemas.ts`, responses in `responses.ts`).
2. Run `npm run typecheck`. TypeScript now points at every place in the API and the web app that must change.
3. Update the API (repository `select`, service, controller) and the web app (services, components).
4. Update the tests and this document.
5. Run `npm test` and `npm run test:e2e`.

**Adding** an optional response field is safe for older clients. **Removing or renaming** a field, or changing its type, is a breaking change: update both sides together.
