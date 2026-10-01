import { z } from 'zod';

// Every request body schema is a *strict* object: unknown keys (e.g. "userId", "dueAt") are rejected
// with 400 instead of silently dropped, so tampering and client bugs surface immediately.

/* ---------- Auth ---------- */
export const credentialsSchema = z.strictObject({
  // Normalize first, then validate, so " Demo@Example.com " is accepted as demo@example.com
  email: z.string().trim().toLowerCase().max(254, 'Email is too long').pipe(z.email('Enter a valid email')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type CredentialsInput = z.infer<typeof credentialsSchema>;

/* ---------- Decks ---------- */
// Limits are exported so the UI (character counters, maxLength) and the API validate identically.
export const DECK_LIMITS = { title: 120, description: 500 } as const;

export const deckInputSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(DECK_LIMITS.title, `Title must be ${DECK_LIMITS.title} characters or fewer`),
  description: z
    .string()
    .trim()
    .max(DECK_LIMITS.description, `Description must be ${DECK_LIMITS.description} characters or fewer`)
    // "", "   " and omitted all mean "no description" → undefined → stored/returned as null.
    // Without this, blank input came back as "" while omitted came back as null.
    .transform((d) => (d === '' ? undefined : d))
    .optional(),
});
export type DeckInput = z.infer<typeof deckInputSchema>;

/* ---------- Cards ---------- */
export const CARD_LIMITS = { side: 2000 } as const;

export const cardInputSchema = z.strictObject({
  front: z.string().trim().min(1, 'Front is required').max(CARD_LIMITS.side),
  back: z.string().trim().min(1, 'Back is required').max(CARD_LIMITS.side),
});
export type CardInput = z.infer<typeof cardInputSchema>;

/* ---------- Study sessions ---------- */
export const MAX_SESSION_CARDS = 50;
/** A card can be answered at most twice per session: the first try plus one retry after a miss. */
export const MAX_ANSWERS_PER_CARD = 2;

export const startSessionSchema = z
  .strictObject({
    /** Practice runs re-study specific cards without changing their schedule. */
    practice: z.boolean().default(false),
    /** Required for practice runs: which cards to practice (e.g. the ones missed). */
    cardIds: z
      .array(z.uuid())
      .min(1)
      .max(MAX_SESSION_CARDS)
      .refine((ids) => new Set(ids).size === ids.length, 'cardIds must not contain duplicates')
      .optional(),
  })
  .refine((v) => !v.practice || v.cardIds, { message: 'Practice sessions need cardIds', path: ['cardIds'] })
  .refine((v) => v.practice || !v.cardIds, { message: 'cardIds is only allowed for practice sessions', path: ['cardIds'] });
export type StartSessionInput = z.input<typeof startSessionSchema>;

export const answerInputSchema = z.strictObject({
  cardId: z.uuid(),
  correct: z.boolean(),
});
export type AnswerInput = z.infer<typeof answerInputSchema>;

export const completeSessionSchema = z.strictObject({
  skipped: z.int().min(0).max(MAX_SESSION_CARDS),
});
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
