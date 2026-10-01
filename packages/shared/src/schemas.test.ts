import { describe, expect, it } from 'vitest';
import {
  CARD_LIMITS,
  DECK_LIMITS,
  MAX_SESSION_CARDS,
  answerInputSchema,
  cardInputSchema,
  completeSessionSchema,
  credentialsSchema,
  deckInputSchema,
  startSessionSchema,
} from './schemas.js';

const ID = '01a0f118-c16b-7752-aa7d-0e1b862ae669';
const ID2 = '01a0f118-c1e6-76bb-b12c-e2ab4bc2c158';
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe('credentialsSchema', () => {
  it('normalizes email: trims and lowercases before validating', () => {
    expect(credentialsSchema.parse({ email: '  Demo@Example.COM ', password: 'password123' }).email).toBe('demo@example.com');
  });
  it('rejects invalid emails, short passwords, and overlong input', () => {
    expect(messages(credentialsSchema.safeParse({ email: 'nope', password: 'password123' }))).toContain('Enter a valid email');
    expect(messages(credentialsSchema.safeParse({ email: 'a@b.co', password: 'short' }))).toContain('Password must be at least 8 characters');
    expect(credentialsSchema.safeParse({ email: `${'a'.repeat(250)}@x.com`, password: 'password123' }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(129) }).success).toBe(false);
  });
  it('is strict: unknown keys are rejected, not silently dropped', () => {
    const r = credentialsSchema.safeParse({ email: 'a@b.co', password: 'password123', role: 'admin' });
    expect(r.success).toBe(false);
    expect(messages(r)[0]).toMatch(/Unrecognized key/);
  });
});

describe('deckInputSchema', () => {
  it('trims the title and requires it', () => {
    expect(deckInputSchema.parse({ title: '  Spanish  ' }).title).toBe('Spanish');
    expect(messages(deckInputSchema.safeParse({ title: '   ' }))).toContain('Title is required');
  });
  it('enforces the shared length limits exactly at the boundary', () => {
    expect(deckInputSchema.safeParse({ title: 'x'.repeat(DECK_LIMITS.title) }).success).toBe(true);
    expect(deckInputSchema.safeParse({ title: 'x'.repeat(DECK_LIMITS.title + 1) }).success).toBe(false);
    expect(deckInputSchema.safeParse({ title: 'T', description: 'x'.repeat(DECK_LIMITS.description) }).success).toBe(true);
    expect(deckInputSchema.safeParse({ title: 'T', description: 'x'.repeat(DECK_LIMITS.description + 1) }).success).toBe(false);
  });
  it('treats omitted, empty and whitespace-only descriptions the same (undefined)', () => {
    expect(deckInputSchema.parse({ title: 'T' }).description).toBeUndefined();
    expect(deckInputSchema.parse({ title: 'T', description: '' }).description).toBeUndefined();
    expect(deckInputSchema.parse({ title: 'T', description: '   ' }).description).toBeUndefined();
    expect(deckInputSchema.parse({ title: 'T', description: ' Verbs ' }).description).toBe('Verbs');
  });
  it('rejects mass-assignment attempts', () => {
    expect(deckInputSchema.safeParse({ title: 'T', userId: ID }).success).toBe(false);
  });
});

describe('cardInputSchema', () => {
  it('requires both sides, trimmed, within the limit', () => {
    expect(cardInputSchema.parse({ front: ' Q ', back: ' A ' })).toEqual({ front: 'Q', back: 'A' });
    expect(messages(cardInputSchema.safeParse({ front: ' ', back: 'A' }))).toContain('Front is required');
    expect(messages(cardInputSchema.safeParse({ front: 'Q', back: '' }))).toContain('Back is required');
    expect(cardInputSchema.safeParse({ front: 'x'.repeat(CARD_LIMITS.side + 1), back: 'A' }).success).toBe(false);
  });
  it('can’t set the schedule or move the card', () => {
    expect(cardInputSchema.safeParse({ front: 'Q', back: 'A', dueAt: '2099-01-01T00:00:00Z' }).success).toBe(false);
    expect(cardInputSchema.safeParse({ front: 'Q', back: 'A', deckId: ID }).success).toBe(false);
  });
});

describe('startSessionSchema', () => {
  it('defaults to a normal (non-practice) session', () => {
    expect(startSessionSchema.parse({})).toEqual({ practice: false });
  });
  it('practice requires cardIds; cardIds require practice', () => {
    expect(messages(startSessionSchema.safeParse({ practice: true }))).toContain('Practice sessions need cardIds');
    expect(messages(startSessionSchema.safeParse({ cardIds: [ID] }))).toContain('cardIds is only allowed for practice sessions');
    expect(startSessionSchema.parse({ practice: true, cardIds: [ID, ID2] }).cardIds).toEqual([ID, ID2]);
  });
  it('cardIds: UUIDs only, no duplicates, 1..MAX_SESSION_CARDS', () => {
    expect(startSessionSchema.safeParse({ practice: true, cardIds: ['nope'] }).success).toBe(false);
    expect(messages(startSessionSchema.safeParse({ practice: true, cardIds: [ID, ID] }))).toContain('cardIds must not contain duplicates');
    expect(startSessionSchema.safeParse({ practice: true, cardIds: [] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_SESSION_CARDS + 1 }, (_, i) => `01a0f118-c16b-7752-aa7d-${String(i).padStart(12, '0')}`);
    expect(startSessionSchema.safeParse({ practice: true, cardIds: tooMany }).success).toBe(false);
  });
});

describe('answer/complete schemas', () => {
  it('answer needs a UUID and a real boolean (no "true" strings)', () => {
    expect(answerInputSchema.safeParse({ cardId: ID, correct: true }).success).toBe(true);
    expect(answerInputSchema.safeParse({ cardId: ID, correct: 'true' }).success).toBe(false);
    expect(answerInputSchema.safeParse({ cardId: 'x', correct: true }).success).toBe(false);
  });
  it('skipped is a whole number within 0..MAX_SESSION_CARDS', () => {
    expect(completeSessionSchema.safeParse({ skipped: 0 }).success).toBe(true);
    expect(completeSessionSchema.safeParse({ skipped: -1 }).success).toBe(false);
    expect(completeSessionSchema.safeParse({ skipped: 1.5 }).success).toBe(false);
    expect(completeSessionSchema.safeParse({ skipped: MAX_SESSION_CARDS + 1 }).success).toBe(false);
  });
});
