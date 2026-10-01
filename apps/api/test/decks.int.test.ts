import { apiErrorSchema, deckDetailSchema, deckSummarySchema } from '@flashcards/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MISSING_ID, contract, createCard, createDeck, signedInUser } from './helpers.js';

describe('decks API', () => {
  it('list starts empty; create → 201 with Location and a DeckDetail', async () => {
    const { agent } = await signedInUser();
    expect((await agent.get('/api/decks').expect(200)).body).toEqual([]);
    const res = await agent.post('/api/decks').send({ title: '  Spanish ', description: 'Basics' }).expect(201);
    const deck = contract(deckDetailSchema, res.body);
    expect(res.headers.location).toBe(`/api/decks/${deck.id}`);
    expect(deck).toMatchObject({ title: 'Spanish', description: 'Basics', cardCount: 0, dueCount: 0, cards: [] });
    const list = contract(z.array(deckSummarySchema), (await agent.get('/api/decks').expect(200)).body);
    expect(list.map((d) => d.id)).toEqual([deck.id]);
  });

  it('get → DeckDetail with cards and counts', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    await createCard(agent, deck.id);
    await createCard(agent, deck.id);
    const detail = contract(deckDetailSchema, (await agent.get(`/api/decks/${deck.id}`).expect(200)).body);
    expect(detail).toMatchObject({ cardCount: 2, dueCount: 2 });
    expect(detail.cards).toHaveLength(2);
  });

  it('duplicate title for the same user → 409; the same title for another user is fine', async () => {
    const a = await signedInUser('a');
    const b = await signedInUser('b');
    await createDeck(a.agent, 'Chemistry');
    const res = await a.agent.post('/api/decks').send({ title: 'Chemistry' }).expect(409);
    expect(contract(apiErrorSchema, res.body).message).toBe('You already have a deck named “Chemistry”');
    await b.agent.post('/api/decks').send({ title: 'Chemistry' }).expect(201);
  });

  it('update → 200 DeckSummary (no card list); renaming onto a taken title → 409', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent, 'One');
    await createDeck(agent, 'Two');
    const res = await agent.put(`/api/decks/${deck.id}`).send({ title: 'Uno', description: 'Spanish' }).expect(200);
    const summary = contract(deckSummarySchema, res.body);
    expect(summary).toMatchObject({ title: 'Uno', description: 'Spanish' });
    expect(res.body).not.toHaveProperty('cards');
    await agent.put(`/api/decks/${deck.id}`).send({ title: 'Two' }).expect(409);
    await agent.put(`/api/decks/${deck.id}`).send({ title: 'Uno' }).expect(200); // keeping its own title is fine
  });

  it('PUT replaces: omitting or blanking the description clears it to null', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent, 'D', 'has one');
    expect((await agent.put(`/api/decks/${deck.id}`).send({ title: 'D', description: '   ' }).expect(200)).body.description).toBeNull();
    expect((await agent.put(`/api/decks/${deck.id}`).send({ title: 'D' }).expect(200)).body.description).toBeNull();
  });

  it('delete → 204 with no body, then 404', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const res = await agent.delete(`/api/decks/${deck.id}`).expect(204);
    expect(res.text).toBe('');
    await agent.get(`/api/decks/${deck.id}`).expect(404);
    await agent.delete(`/api/decks/${deck.id}`).expect(404);
  });

  it('malformed id → 400 "Invalid deck id"; unknown id → 404', async () => {
    const { agent } = await signedInUser();
    const res = await agent.get('/api/decks/not-a-uuid').expect(400);
    expect(contract(apiErrorSchema, res.body)).toEqual({ message: 'Invalid deck id', details: { deckId: ['Invalid deck id'] } });
    await agent.get(`/api/decks/${MISSING_ID}`).expect(404);
  });

  it('another user’s deck is a 404 for every verb (never 403: existence isn’t revealed)', async () => {
    const owner = await signedInUser('owner');
    const other = await signedInUser('other');
    const deck = await createDeck(owner.agent, 'Private');
    await other.agent.get(`/api/decks/${deck.id}`).expect(404);
    await other.agent.put(`/api/decks/${deck.id}`).send({ title: 'Hijacked' }).expect(404);
    await other.agent.delete(`/api/decks/${deck.id}`).expect(404);
    expect((await other.agent.get('/api/decks').expect(200)).body).toEqual([]);
    expect((await owner.agent.get(`/api/decks/${deck.id}`).expect(200)).body.title).toBe('Private');
  });

  it('strict bodies: unknown fields → 400, nothing written', async () => {
    const { agent } = await signedInUser();
    const other = await signedInUser('victim');
    const res = await agent.post('/api/decks').send({ title: 'X', userId: other.user.id }).expect(400);
    expect(res.body.message).toBe('Unrecognized key: "userId"');
    expect((await other.agent.get('/api/decks').expect(200)).body).toEqual([]);
  });

  it('requires auth', async () => {
    const { agent } = await signedInUser();
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/decks').expect(401);
  });
});
