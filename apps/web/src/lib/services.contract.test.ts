/**
 * Enforces "every frontend service validates every response with the shared schema":
 * 1. Every service method rejects a response that breaks its contract (none trust the server).
 * 2. Every service method accepts a response that matches it.
 * 3. No file except the API client calls fetch() directly (nothing can bypass validation).
 * Methods are discovered from the service objects, so a newly added one is covered automatically.
 */
import type { Card, DeckDetail, DeckSummary, SessionDetail, User } from '@flashcards/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../features/auth/api';
import { cardsApi } from '../features/cards/api';
import { decksApi } from '../features/decks/api';
import { studyApi } from '../features/study/api';
import { ContractError } from './apiClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ID = '01a0f118-c16b-7752-aa7d-0e1b862ae669';
const AT = '2026-10-01T07:03:51.111Z';
const user: User = { id: ID, email: 'demo@example.com' };
const card: Card = { id: ID, deckId: ID, front: 'Q', back: 'A', interval: 0, repetitions: 0, easeFactor: 2.5, dueAt: AT };
const summary: DeckSummary = { id: ID, title: 'T', description: null, updatedAt: AT, cardCount: 1, dueCount: 1 };
const detail: DeckDetail = { ...summary, cards: [card] };
const session = { id: ID, deckId: ID, practice: false, cardCount: 1, skipped: 0, startedAt: AT, completedAt: null };
const sessionDetail: SessionDetail = { ...session, correct: 1, incorrect: 0, answers: [{ id: ID, cardId: ID, correct: true, answeredAt: AT }] };

/** Every service method, how to call it, and a valid response for it (undefined = 204 No Content). */
const cases: Record<string, { call: () => Promise<unknown>; valid: unknown }> = {
  'authApi.me': { call: () => authApi.me(), valid: user },
  'authApi.login': { call: () => authApi.login({ email: 'a@b.co', password: 'password123' }), valid: user },
  'authApi.signup': { call: () => authApi.signup({ email: 'a@b.co', password: 'password123' }), valid: user },
  'authApi.logout': { call: () => authApi.logout(), valid: undefined },
  'decksApi.list': { call: () => decksApi.list(), valid: [summary] },
  'decksApi.get': { call: () => decksApi.get(ID), valid: detail },
  'decksApi.create': { call: () => decksApi.create({ title: 'T' }), valid: detail },
  'decksApi.update': { call: () => decksApi.update(ID, { title: 'T' }), valid: summary },
  'decksApi.remove': { call: () => decksApi.remove(ID), valid: undefined },
  'cardsApi.create': { call: () => cardsApi.create(ID, { front: 'Q', back: 'A' }), valid: card },
  'cardsApi.update': { call: () => cardsApi.update(ID, { front: 'Q', back: 'A' }), valid: card },
  'cardsApi.remove': { call: () => cardsApi.remove(ID), valid: undefined },
  'studyApi.start': { call: () => studyApi.start(ID), valid: { session, cards: [card] } },
  'studyApi.answer': { call: () => studyApi.answer(ID, { cardId: ID, correct: true }), valid: { answer: sessionDetail.answers[0], card } },
  'studyApi.complete': { call: () => studyApi.complete(ID, { skipped: 0 }), valid: sessionDetail },
};

const reply = (status: number, body?: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })));

describe('service registry', () => {
  it('covers every method on every service (a new method must be added here)', () => {
    const discovered = Object.entries({ authApi, decksApi, cardsApi, studyApi }).flatMap(([svc, obj]) =>
      Object.keys(obj).map((m) => `${svc}.${m}`),
    );
    expect(discovered.sort()).toEqual(Object.keys(cases).sort());
  });
});

describe.each(Object.entries(cases))('%s', (_name, { call, valid }) => {
  it('accepts a response that matches the shared schema', async () => {
    if (valid === undefined) reply(204);
    else reply(200, valid);
    await expect(call()).resolves.toEqual(valid);
  });

  it('rejects a response that breaks the contract (never passes bad data on)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reply(200, { unexpected: true, due_at: 12345 });
    await expect(call()).rejects.toBeInstanceOf(ContractError);
  });
});

describe('no bypasses', () => {
  it('only lib/apiClient.ts calls fetch()', () => {
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(([file, code]) => !/(^|\/)apiClient\.ts$/.test(file) && /\bfetch\s*\(/.test(code))
      .map(([file]) => file);
    expect(Object.keys(sources).length).toBeGreaterThan(20); // sanity: the glob really found the app
    expect(offenders).toEqual([]);
  });
});
