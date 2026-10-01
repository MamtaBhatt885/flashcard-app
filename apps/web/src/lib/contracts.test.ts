import {
  apiErrorSchema,
  cardSchema,
  deckDetailSchema,
  deckSchema,
  studySessionSchema,
  type Card,
} from '@flashcards/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, ContractError } from './apiClient';

afterEach(() => vi.unstubAllGlobals());

const card: Card = {
  id: '01a0f118-c1e6-76bb-b12c-e2ab4bc2c158',
  deckId: '01a0f118-c16b-7752-aa7d-0e1b862ae669',
  front: 'H₂O',
  back: 'Water',
  interval: 1,
  repetitions: 1,
  easeFactor: 2.5,
  dueAt: '2026-10-01T07:03:51.111Z',
};

const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

describe('shared schemas', () => {
  it('Card: accepts the API shape', () => {
    expect(cardSchema.parse(card)).toEqual(card);
  });

  it('dates must be ISO 8601 UTC strings: not epoch numbers, not other formats', () => {
    expect(cardSchema.safeParse({ ...card, dueAt: 1790748762181 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...card, dueAt: '2026-10-01 07:03' }).success).toBe(false);
    expect(cardSchema.safeParse({ ...card, dueAt: 'Thu Oct 01 2026' }).success).toBe(false);
  });

  it('fields are camelCase: snake_case keys are a contract violation', () => {
    const { deckId: _deckId, dueAt: _dueAt, ...rest } = card;
    const snake = { ...rest, deck_id: card.deckId, due_at: card.dueAt };
    const result = cardSchema.safeParse(snake);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['deckId', 'dueAt']));
  });

  it('Deck: description is nullable but required; extra fields are stripped, not fatal', () => {
    const deck = { id: card.deckId, title: 'Chemistry', description: null, updatedAt: card.dueAt };
    expect(deckSchema.parse({ ...deck, addedLater: true })).toEqual(deck);
    const { description: _d, ...missing } = deck;
    expect(deckSchema.safeParse(missing).success).toBe(false);
  });

  it('DeckDetail validates every nested card', () => {
    const detail = { id: card.deckId, title: 'C', description: null, updatedAt: card.dueAt, cardCount: 1, dueCount: 0 };
    expect(deckDetailSchema.safeParse({ ...detail, cards: [card] }).success).toBe(true);
    expect(deckDetailSchema.safeParse({ ...detail, cards: [{ ...card, easeFactor: 'high' }] }).success).toBe(false);
  });

  it('StudySession: completedAt is an ISO string or null while in progress', () => {
    const s = {
      id: '01a0f118-c22b-74dd-b488-ca8eeb49c829',
      deckId: card.deckId,
      practice: false,
      cardCount: 5,
      skipped: 0,
      startedAt: card.dueAt,
      completedAt: null,
    };
    expect(studySessionSchema.safeParse(s).success).toBe(true);
    expect(studySessionSchema.safeParse({ ...s, completedAt: card.dueAt }).success).toBe(true);
    expect(studySessionSchema.safeParse({ ...s, completedAt: undefined }).success).toBe(false);
  });

  it('ApiError: message required, details are per-field string arrays', () => {
    expect(apiErrorSchema.parse({ message: 'Invalid input', details: { title: ['Title is required'] } })).toBeTruthy();
    expect(apiErrorSchema.safeParse({ details: {} }).success).toBe(false);
    expect(apiErrorSchema.safeParse({ message: 'x', details: { title: 'not an array' } }).success).toBe(false);
  });
});

describe('api() enforces the contracts at runtime', () => {
  it('returns parsed data when the response matches', async () => {
    respond(200, card);
    await expect(api('/cards/x', cardSchema)).resolves.toEqual(card);
  });

  it('throws ContractError (instead of passing bad data on) when it doesn’t', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(200, { ...card, dueAt: 12345 });
    const err = await api('/cards/x', cardSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContractError);
    expect((err as ContractError).message).toContain('dueAt');
  });

  it('parses error bodies with apiErrorSchema, and survives non-JSON errors (e.g. a proxy page)', async () => {
    respond(400, { message: 'Invalid input', details: { title: ['Title is required'] } });
    const err = (await api('/decks', deckSchema).catch((e: unknown) => e)) as ApiError;
    expect(err.details).toEqual({ title: ['Title is required'] });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' })));
    const proxy = (await api('/decks', deckSchema).catch((e: unknown) => e)) as ApiError;
    expect(proxy).toBeInstanceOf(ApiError);
    expect(proxy.message).toBe('Bad Gateway');
  });
});
