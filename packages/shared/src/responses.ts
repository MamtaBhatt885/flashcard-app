import { z } from 'zod';

/**
 * Shared API contracts: the shapes the API sends and the web app receives.
 *
 * - One definition per entity: each TypeScript type is `z.infer` of its schema,
 *   so the runtime check and the compile-time type can never drift apart.
 * - Field names are camelCase on the wire (same as in code; no snake_case mapping layer).
 * - Dates travel as ISO 8601 UTC strings ("2026-09-30T07:03:51.111Z"), never Date objects
 *   or epoch numbers, because JSON has no date type and ISO strings sort and parse unambiguously.
 * - Schemas are NOT strict: the API may add fields without breaking older clients.
 *   Unknown fields are stripped; missing or mistyped ones fail loudly.
 */

/** ISO 8601 UTC timestamp, as produced by `Date.prototype.toISOString()`. */
export const isoDateTime = z.iso.datetime({ message: 'Expected an ISO 8601 UTC date string' });
const id = z.uuid();
const count = z.int().nonnegative();

/* ---------- User ---------- */

export const userSchema = z.object({
  id,
  email: z.email(),
});
export type User = z.infer<typeof userSchema>;

/* ---------- Card ---------- */

export const cardSchema = z.object({
  id,
  deckId: id,
  front: z.string(),
  back: z.string(),
  /** SM-2 schedule: days until the next review after the current one. */
  interval: count,
  /** SM-2 schedule: consecutive correct answers. */
  repetitions: count,
  /** SM-2 schedule: how quickly intervals grow for this card (1.3 – 2.5). */
  easeFactor: z.number().min(1.3),
  dueAt: isoDateTime,
});
export type Card = z.infer<typeof cardSchema>;

/* ---------- Deck ---------- */

/** The deck entity itself. */
export const deckSchema = z.object({
  id,
  title: z.string(),
  description: z.string().nullable(),
  updatedAt: isoDateTime,
});
export type Deck = z.infer<typeof deckSchema>;

/** A deck as listed: the entity plus counts (GET /decks, PUT /decks/:id). */
export const deckSummarySchema = deckSchema.extend({
  cardCount: count,
  dueCount: count,
});
export type DeckSummary = z.infer<typeof deckSummarySchema>;

/** A deck with its cards (GET /decks/:id, POST /decks). */
export const deckDetailSchema = deckSummarySchema.extend({
  cards: z.array(cardSchema),
});
export type DeckDetail = z.infer<typeof deckDetailSchema>;

/* ---------- StudySession ---------- */

export const studySessionSchema = z.object({
  id,
  deckId: id,
  /** Practice runs don't change the review schedule. */
  practice: z.boolean(),
  /** Cards queued when the session started. */
  cardCount: count,
  skipped: count,
  startedAt: isoDateTime,
  /** null while the session is in progress. */
  completedAt: isoDateTime.nullable(),
});
export type StudySession = z.infer<typeof studySessionSchema>;

export const sessionAnswerSchema = z.object({
  id,
  cardId: id,
  correct: z.boolean(),
  answeredAt: isoDateTime,
});
export type SessionAnswer = z.infer<typeof sessionAnswerSchema>;

/** A session with its score (GET /decks/:id/sessions). */
export const sessionSummarySchema = studySessionSchema.extend({
  correct: count,
  incorrect: count,
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

/** A session with every answer (GET /sessions/:id, POST /sessions/:id/complete). */
export const sessionDetailSchema = sessionSummarySchema.extend({
  answers: z.array(sessionAnswerSchema),
});
export type SessionDetail = z.infer<typeof sessionDetailSchema>;

/** POST /decks/:id/sessions. `session` is null when nothing was due (no session is created). */
export const startSessionResponseSchema = z.object({
  session: studySessionSchema.nullable(),
  cards: z.array(cardSchema),
});
export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;

/** POST /sessions/:id/answers. */
export const answerResponseSchema = z.object({
  answer: sessionAnswerSchema,
  card: cardSchema,
});
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

/* ---------- ApiError ---------- */

/** Per-field validation messages, e.g. { title: ["Title is required"] }. */
export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()));
export type FieldErrors = z.infer<typeof fieldErrorsSchema>;

/** Body of every 4xx/5xx response. */
export const apiErrorSchema = z.object({
  /** Human-readable, safe to show in the UI. */
  message: z.string(),
  /** Present for validation errors (400). */
  details: fieldErrorsSchema.optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
