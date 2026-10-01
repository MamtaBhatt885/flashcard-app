import {
  answerResponseSchema,
  apiErrorSchema,
  sessionDetailSchema,
  sessionSummarySchema,
  startSessionResponseSchema,
} from '@flashcards/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type Agent, MISSING_ID, contract, createCard, createDeck, signedInUser } from './helpers.js';

const DAY = 86_400_000;

async function deckWithCards(agent: Agent, n: number) {
  const deck = await createDeck(agent);
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(await createCard(agent, deck.id));
  return { deck, cards };
}

async function start(agent: Agent, deckId: string, body: object = {}) {
  const res = await agent.post(`/api/decks/${deckId}/sessions`).send(body);
  return { status: res.status, headers: res.headers, body: contract(startSessionResponseSchema, res.body) };
}

describe('sessions API', () => {
  it('start → 201 with Location and every due card', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 3);
    const s = await start(agent, deck.id);
    expect(s.status).toBe(201);
    expect(s.headers.location).toBe(`/api/sessions/${s.body.session!.id}`);
    expect(s.body.session).toMatchObject({ deckId: deck.id, practice: false, cardCount: 3, skipped: 0, completedAt: null });
    expect(s.body.cards.map((c) => c.id).sort()).toEqual(cards.map((c) => c.id).sort());
  });

  it('nothing due → 200 with session: null (no empty session created)', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const s = await start(agent, deck.id);
    expect(s.status).toBe(200);
    expect(s.body).toEqual({ session: null, cards: [] });
    expect((await agent.get(`/api/decks/${deck.id}/sessions`).expect(200)).body).toEqual([]);
  });

  it('a correct answer reschedules the card 1 day out; it’s no longer due', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 1);
    const s = await start(agent, deck.id);
    const before = Date.now();
    const res = await agent.post(`/api/sessions/${s.body.session!.id}/answers`).send({ cardId: cards[0]!.id, correct: true }).expect(201);
    const { card, answer } = contract(answerResponseSchema, res.body);
    expect(answer).toMatchObject({ cardId: cards[0]!.id, correct: true });
    expect(card).toMatchObject({ interval: 1, repetitions: 1 });
    expect(new Date(card.dueAt).getTime() - before).toBeGreaterThan(0.99 * DAY);
    expect((await agent.get(`/api/decks/${deck.id}`).expect(200)).body.dueCount).toBe(0);
  });

  it('retry rules: 2nd answer recorded but doesn’t reschedule; 3rd → 409', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 1);
    const id = (await start(agent, deck.id)).body.session!.id;
    const cardId = cards[0]!.id;
    const first = await agent.post(`/api/sessions/${id}/answers`).send({ cardId, correct: false }).expect(201);
    const second = await agent.post(`/api/sessions/${id}/answers`).send({ cardId, correct: true }).expect(201);
    expect(second.body.card.dueAt).toBe(first.body.card.dueAt);
    const third = await agent.post(`/api/sessions/${id}/answers`).send({ cardId, correct: true }).expect(409);
    expect(contract(apiErrorSchema, third.body).message).toBe('This card was already answered in this session');
  });

  it('a card that wasn’t due when the session started → 409', async () => {
    const { agent } = await signedInUser();
    const { deck } = await deckWithCards(agent, 1);
    const id = (await start(agent, deck.id)).body.session!.id;
    const late = await createCard(agent, deck.id);
    const res = await agent.post(`/api/sessions/${id}/answers`).send({ cardId: late.id, correct: true }).expect(409);
    expect(res.body.message).toBe('This card wasn’t due when the session started');
  });

  it('complete → SessionDetail with score and answers; idempotent; then answers → 409', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 3);
    const id = (await start(agent, deck.id)).body.session!.id;
    await agent.post(`/api/sessions/${id}/answers`).send({ cardId: cards[0]!.id, correct: true }).expect(201);
    await agent.post(`/api/sessions/${id}/answers`).send({ cardId: cards[1]!.id, correct: false }).expect(201);
    const done = contract(sessionDetailSchema, (await agent.post(`/api/sessions/${id}/complete`).send({ skipped: 1 }).expect(200)).body);
    expect(done).toMatchObject({ correct: 1, incorrect: 1, skipped: 1, cardCount: 3 });
    expect(done.completedAt).not.toBeNull();
    expect(done.answers.map((a) => a.cardId)).toEqual([cards[0]!.id, cards[1]!.id]);
    const again = (await agent.post(`/api/sessions/${id}/complete`).send({ skipped: 2 }).expect(200)).body;
    expect(again).toEqual(done);
    await agent.post(`/api/sessions/${id}/answers`).send({ cardId: cards[2]!.id, correct: true }).expect(409);
  });

  it('complete: skipped can’t exceed the session’s cards → 400', async () => {
    const { agent } = await signedInUser();
    const { deck } = await deckWithCards(agent, 2);
    const id = (await start(agent, deck.id)).body.session!.id;
    const res = await agent.post(`/api/sessions/${id}/complete`).send({ skipped: 3 }).expect(400);
    expect(res.body.details.skipped[0]).toBe('Can\'t skip more than the 2 cards in this session');
  });

  it('practice: only the given cards, answers recorded, schedule untouched', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 2);
    const s = await start(agent, deck.id, { practice: true, cardIds: [cards[1]!.id] });
    expect(s.body.session!.practice).toBe(true);
    expect(s.body.cards.map((c) => c.id)).toEqual([cards[1]!.id]);
    const res = await agent.post(`/api/sessions/${s.body.session!.id}/answers`).send({ cardId: cards[1]!.id, correct: true }).expect(201);
    expect(res.body.card).toEqual(cards[1]); // unchanged schedule
  });

  it('practice: a card from another deck → 404; duplicates → 400', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 1);
    const other = await deckWithCards(agent, 1);
    await agent.post(`/api/decks/${deck.id}/sessions`).send({ practice: true, cardIds: [other.cards[0]!.id] }).expect(404);
    expect((await agent.post(`/api/decks/${deck.id}/sessions`).send({ practice: true, cardIds: [cards[0]!.id, cards[0]!.id] })).status).toBe(400);
  });

  it('history: GET /decks/:id/sessions lists sessions newest first with scores', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 1);
    const s1 = (await start(agent, deck.id)).body.session!.id;
    await agent.post(`/api/sessions/${s1}/answers`).send({ cardId: cards[0]!.id, correct: false }).expect(201);
    const s2 = (await start(agent, deck.id, { practice: true, cardIds: [cards[0]!.id] })).body.session!.id;
    const list = contract(z.array(sessionSummarySchema), (await agent.get(`/api/decks/${deck.id}/sessions`).expect(200)).body);
    expect(list.map((s) => s.id)).toEqual([s2, s1]);
    expect(list[1]).toMatchObject({ correct: 0, incorrect: 1 });
  });

  it('isolation and not-found: another user can’t see, answer, or complete your session', async () => {
    const owner = await signedInUser('owner');
    const other = await signedInUser('other');
    const { deck, cards } = await deckWithCards(owner.agent, 1);
    const id = (await start(owner.agent, deck.id)).body.session!.id;
    await other.agent.get(`/api/sessions/${id}`).expect(404);
    await other.agent.post(`/api/sessions/${id}/answers`).send({ cardId: cards[0]!.id, correct: true }).expect(404);
    await other.agent.post(`/api/sessions/${id}/complete`).send({ skipped: 0 }).expect(404);
    await other.agent.post(`/api/decks/${deck.id}/sessions`).send({}).expect(404);
    await owner.agent.get(`/api/sessions/${MISSING_ID}`).expect(404);
    await owner.agent.get('/api/sessions/nope').expect(400);
  });

  it('deleting a deck cascades to its sessions and answers', async () => {
    const { agent } = await signedInUser();
    const { deck, cards } = await deckWithCards(agent, 1);
    const id = (await start(agent, deck.id)).body.session!.id;
    await agent.post(`/api/sessions/${id}/answers`).send({ cardId: cards[0]!.id, correct: true }).expect(201);
    await agent.delete(`/api/decks/${deck.id}`).expect(204);
    await agent.get(`/api/sessions/${id}`).expect(404);
  });
});
