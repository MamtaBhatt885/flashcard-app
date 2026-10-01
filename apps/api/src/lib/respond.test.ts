import { cardSchema, userSchema } from '@flashcards/shared';
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import { ResponseContractError, sendError, sendJson } from './respond.js';

/** Minimal stand-in for an Express response that records what would be sent. */
function fakeRes() {
  const sent: { status?: number; body?: unknown } = {};
  const res = {
    req: { method: 'GET', originalUrl: '/api/test' },
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(body: unknown) {
      sent.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, sent };
}

const user = { id: '01a0f118-c16b-7752-aa7d-0e1b862ae669', email: 'demo@example.com' };
const card = {
  id: '01a0f118-c1e6-76bb-b12c-e2ab4bc2c158',
  deckId: user.id,
  front: 'Q',
  back: 'A',
  interval: 0,
  repetitions: 0,
  easeFactor: 2.5,
  dueAt: '2026-10-01T07:03:51.111Z',
};

describe('sendJson', () => {
  it('sends data that matches the contract, with the given status', () => {
    const { res, sent } = fakeRes();
    sendJson(res, userSchema, user, 201);
    expect(sent).toEqual({ status: 201, body: user });
  });

  it('strips fields that are not in the contract, so a stray passwordHash never leaves the server', () => {
    const { res, sent } = fakeRes();
    const leaky = { ...user, passwordHash: 'scrypt$65536$8$2$salt$hash' };
    sendJson(res, userSchema, leaky as typeof user);
    expect(sent.body).toEqual(user);
    expect(JSON.stringify(sent.body)).not.toContain('passwordHash');
  });

  it('refuses to send contract-breaking data (e.g. a Date instead of an ISO string) and sends nothing', () => {
    const { res, sent } = fakeRes();
    const buggy = { ...card, dueAt: new Date('2026-10-01') };
    expect(() => sendJson(res, cardSchema, buggy as unknown as typeof card)).toThrow(ResponseContractError);
    expect(() => sendJson(res, cardSchema, buggy as unknown as typeof card)).toThrow(/dueAt/);
    expect(sent.body).toBeUndefined();
  });

  it('catches missing fields', () => {
    const { res } = fakeRes();
    const { deckId: _deckId, ...missing } = card;
    expect(() => sendJson(res, cardSchema, missing as typeof card)).toThrow(/deckId/);
  });
});

describe('sendError', () => {
  it('sends an ApiError body with optional field details', () => {
    const { res, sent } = fakeRes();
    sendError(res, 400, 'Invalid input', { title: ['Title is required'] });
    expect(sent).toEqual({ status: 400, body: { message: 'Invalid input', details: { title: ['Title is required'] } } });
  });
});
