/**
 * Cases the first integration pass missed (added in the critique step):
 * rate limiting + persistence, forged/expired tokens, SM-2 over several days,
 * transport errors and headers, and concurrent writes.
 */
import { apiErrorSchema, cardSchema, startSessionResponseSchema } from '@flashcards/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, contract, createCard, createDeck, signedInUser, type Agent } from './helpers.js';

const SECRET = process.env.JWT_SECRET!;

describe('rate limiting (login/signup), stored in the database', () => {
  const originalMax = process.env.AUTH_RATE_LIMIT_MAX;
  afterAll(() => {
    process.env.AUTH_RATE_LIMIT_MAX = originalMax;
  });

  /** A fresh copy of the whole app (new modules, new rate-limit store), like a server restart. */
  async function bootApp(limit: number) {
    vi.resetModules();
    process.env.AUTH_RATE_LIMIT_MAX = String(limit);
    const mod = await import('../src/app.js');
    return mod.createApp();
  }

  it('blocks after the limit with an ApiError that says when to retry, and survives a restart', async () => {
    await prisma.rateLimit.deleteMany();
    const bad = { email: 'nobody@test.dev', password: 'wrongpass1' };

    const first = await bootApp(3);
    for (let i = 0; i < 3; i++) await request(first).post('/api/auth/login').send(bad).expect(401);
    const blocked = await request(first).post('/api/auth/login').send(bad).expect(429);
    expect(contract(apiErrorSchema, blocked.body).message).toMatch(/^Too many attempts\. Try again in \d+ minutes?\.$/);

    const restarted = await bootApp(3); // before the fix, an in-memory store forgot everything here
    await request(restarted).post('/api/auth/login').send(bad).expect(429);
    await request(restarted).post('/api/auth/signup').send({ email: 'x@test.dev', password: 'password123' }).expect(429);

    await prisma.rateLimit.deleteMany(); // don't leak into later tests
  });
});

describe('forged and expired auth tokens are rejected with 401', () => {
  async function meWith(token: string) {
    return request(app).get('/api/auth/me').set('Cookie', `token=${token}`);
  }

  it('valid token works (control)', async () => {
    const { user } = await signedInUser();
    const token = jwt.sign({}, SECRET, { subject: user.id, expiresIn: 60, algorithm: 'HS256' });
    expect((await meWith(token)).status).toBe(200);
  });

  it('expired token', async () => {
    const { user } = await signedInUser();
    const token = jwt.sign({}, SECRET, { subject: user.id, expiresIn: -10, algorithm: 'HS256' });
    const res = await meWith(token);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Session expired, please sign in again');
  });

  it('token signed with a different secret', async () => {
    const { user } = await signedInUser();
    expect((await meWith(jwt.sign({}, 'attacker-secret-that-is-at-least-32-chars', { subject: user.id }))).status).toBe(401);
  });

  it('tampered payload (swapping in another user id)', async () => {
    const a = await signedInUser('a');
    const b = await signedInUser('b');
    const [header, , signature] = jwt.sign({}, SECRET, { subject: a.user.id }).split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: b.user.id, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    expect((await meWith(`${header}.${forgedPayload}.${signature}`)).status).toBe(401);
  });

  it('"alg: none" unsigned token', async () => {
    const { user } = await signedInUser();
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect((await meWith(`${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: user.id })}.`)).status).toBe(401);
  });

  it('a token for a user that no longer exists', async () => {
    const { user } = await signedInUser();
    await prisma.user.delete({ where: { id: user.id } });
    expect((await meWith(jwt.sign({}, SECRET, { subject: user.id }))).status).toBe(401);
  });
});

describe('SM-2 scheduling across several days, through the real API', () => {
  /** Makes the card due now (as if days passed), studies it in a new session, returns the updated card. */
  async function reviewOnNextDay(agent: Agent, deckId: string, cardId: string, correct: boolean) {
    await prisma.card.update({ where: { id: cardId }, data: { dueAt: new Date(Date.now() - 1000) } });
    const start = contract(startSessionResponseSchema, (await agent.post(`/api/decks/${deckId}/sessions`).send({}).expect(201)).body);
    const res = await agent.post(`/api/sessions/${start.session!.id}/answers`).send({ cardId, correct }).expect(201);
    return contract(cardSchema, res.body.card);
  }

  it('intervals grow 1 → 6 → 15 days with consecutive correct answers', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const card = await createCard(agent, deck.id);
    const intervals = [];
    for (let day = 0; day < 3; day++) intervals.push((await reviewOnNextDay(agent, deck.id, card.id, true)).interval);
    expect(intervals).toEqual([1, 6, 15]);
  });

  it('after a miss, ease recovers with correct answers (no "ease hell") but never exceeds 2.5', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const card = await createCard(agent, deck.id);
    const missed = await reviewOnNextDay(agent, deck.id, card.id, false);
    expect(missed).toMatchObject({ easeFactor: 1.96, repetitions: 0, interval: 1 });
    const eases = [];
    for (let day = 0; day < 8; day++) eases.push((await reviewOnNextDay(agent, deck.id, card.id, true)).easeFactor);
    expect(eases.slice(0, 3)).toEqual([2.06, 2.16, 2.26]); // recovers +0.1 per correct review
    expect(Math.max(...eases)).toBe(2.5); // …capped at the default
  });
});

describe('transport errors and headers', () => {
  it('malformed JSON → 400 "Malformed JSON body"', async () => {
    const { agent } = await signedInUser();
    const res = await agent.post('/api/decks').set('Content-Type', 'application/json').send('{"title": ').expect(400);
    expect(contract(apiErrorSchema, res.body).message).toBe('Malformed JSON body');
  });

  it('body over the 100kb limit → 413 with an ApiError body', async () => {
    const { agent } = await signedInUser();
    const res = await agent.post('/api/decks').send({ title: 'x', description: 'y'.repeat(150_000) }).expect(413);
    contract(apiErrorSchema, res.body);
  });

  it('unknown route → 404 ApiError', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(contract(apiErrorSchema, res.body).message).toBe('Route not found');
  });

  it('security headers: no x-powered-by; helmet defaults present', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('logout actually clears the cookie (expired Set-Cookie)', async () => {
    const { agent } = await signedInUser();
    const res = await agent.post('/api/auth/logout').expect(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe('concurrent writes', () => {
  it('8 simultaneous creates of the same deck title → exactly one 201, the rest 409, no 500s', async () => {
    const { agent } = await signedInUser();
    const statuses = await Promise.all(
      Array.from({ length: 8 }, () => agent.post('/api/decks').send({ title: 'Race' }).then((r) => r.status)),
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
  });

  it('simultaneous answers for the same card: at most 2 accepted (first try + retry)', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const card = await createCard(agent, deck.id);
    const start = contract(startSessionResponseSchema, (await agent.post(`/api/decks/${deck.id}/sessions`).send({}).expect(201)).body);
    const statuses = await Promise.all(
      Array.from({ length: 6 }, () =>
        agent.post(`/api/sessions/${start.session!.id}/answers`).send({ cardId: card.id, correct: true }).then((r) => r.status),
      ),
    );
    const accepted = statuses.filter((s) => s === 201).length;
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
    expect(accepted).toBeLessThanOrEqual(2);
  });
});
