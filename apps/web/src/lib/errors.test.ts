import { deckSummarySchema } from '@flashcards/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { api, ApiError, ContractError, NetworkError } from './apiClient';
import { errorMessage, isNotFound } from './errors';

afterEach(() => vi.unstubAllGlobals());

describe('api() error classification', () => {
  it('a failed fetch (server down) becomes a NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/decks', z.array(deckSummarySchema))).rejects.toBeInstanceOf(NetworkError);
  });

  it('an error status becomes an ApiError with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Deck not found' }), { status: 404 })));
    const err = (await api('/decks/x', deckSummarySchema).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });
});

describe('errorMessage()', () => {
  it('says "can’t reach the server" only for real network failures', () => {
    expect(errorMessage(new NetworkError(new TypeError('Failed to fetch')))).toMatch(/Can’t reach the server/);
  });

  it('BEFORE this fix, a plain bug was misreported as the server being down; now it isn’t', () => {
    let bug: unknown;
    try {
      (undefined as unknown as { title: string }).title; // eslint-disable-line @typescript-eslint/no-unused-expressions
    } catch (e) {
      bug = e; // TypeError: Cannot read properties of undefined
    }
    expect(bug).toBeInstanceOf(TypeError);
    expect(errorMessage(bug)).not.toMatch(/reach the server/);
  });
});

// ---- added in the critique pass ----
describe('isNotFound() (a mistyped URL shows "Deck not found", not a raw error)', () => {
  it('404 → not found', () => expect(isNotFound(new ApiError(404, 'Deck not found'))).toBe(true));
  it('400 for a malformed id in the URL → not found', () =>
    expect(isNotFound(new ApiError(400, 'Invalid deck id', { deckId: ['Invalid deck id'] }))).toBe(true));
  it('400 for an invalid body → NOT not-found', () =>
    expect(isNotFound(new ApiError(400, 'Title is required', { title: ['Title is required'] }))).toBe(false));
  it('other failures → NOT not-found', () => {
    expect(isNotFound(new ApiError(500, 'boom'))).toBe(false);
    expect(isNotFound(new NetworkError(new TypeError('x')))).toBe(false);
    expect(isNotFound(new ContractError('/decks', []))).toBe(false);
  });
});

describe('errorMessage() for a generic 400', () => {
  it('shows the first field reason instead of "Invalid input"', () =>
    expect(errorMessage(new ApiError(400, 'Invalid input', { skipped: ['Can’t skip more than the 2 cards'] }))).toBe('Can’t skip more than the 2 cards'));
});
