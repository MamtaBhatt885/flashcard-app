import { cardSchema, deckSummarySchema } from '@flashcards/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MISSING_ID, contract, createCard, createDeck, signedInUser } from './helpers.js';

describe('cards API', () => {
  it('create → 201 with Location; a new card is due immediately', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const res = await agent.post(`/api/decks/${deck.id}/cards`).send({ front: ' H2O ', back: 'Water' }).expect(201);
    const card = contract(cardSchema, res.body);
    expect(res.headers.location).toBe(`/api/cards/${card.id}`);
    expect(card).toMatchObject({ deckId: deck.id, front: 'H2O', back: 'Water', interval: 0, repetitions: 0, easeFactor: 2.5 });
    expect(new Date(card.dueAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('list and get', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const a = await createCard(agent, deck.id, 'first');
    const b = await createCard(agent, deck.id, 'second');
    const list = contract(z.array(cardSchema), (await agent.get(`/api/decks/${deck.id}/cards`).expect(200)).body);
    expect(list.map((c) => c.id)).toEqual([a.id, b.id]); // oldest first
    expect((await agent.get(`/api/cards/${a.id}`).expect(200)).body).toEqual(a);
  });

  it('update → 200 with new content; schedule untouched', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const card = await createCard(agent, deck.id);
    const res = await agent.put(`/api/cards/${card.id}`).send({ front: 'New Q', back: 'New A' }).expect(200);
    expect(contract(cardSchema, res.body)).toEqual({ ...card, front: 'New Q', back: 'New A' });
  });

  it('delete → 204, then 404; the deck count drops', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const card = await createCard(agent, deck.id);
    await agent.delete(`/api/cards/${card.id}`).expect(204);
    await agent.get(`/api/cards/${card.id}`).expect(404);
    await agent.delete(`/api/cards/${card.id}`).expect(404);
    expect((await agent.get(`/api/decks/${deck.id}`).expect(200)).body.cardCount).toBe(0);
  });

  it('validation: missing side → 400; schedule/deck fields can’t be set → 400', async () => {
    const { agent } = await signedInUser();
    const deck = await createDeck(agent);
    const card = await createCard(agent, deck.id);
    await agent.post(`/api/decks/${deck.id}/cards`).send({ front: 'only front' }).expect(400);
    await agent.put(`/api/cards/${card.id}`).send({ front: 'Q', back: 'A', dueAt: '2099-01-01T00:00:00.000Z' }).expect(400);
    await agent.put(`/api/cards/${card.id}`).send({ front: 'Q', back: 'A', deckId: MISSING_ID }).expect(400);
    expect((await agent.get(`/api/cards/${card.id}`).expect(200)).body).toEqual(card);
  });

  it('unknown or foreign deck/card → 404; malformed ids → 400', async () => {
    const owner = await signedInUser('owner');
    const other = await signedInUser('other');
    const deck = await createDeck(owner.agent);
    const card = await createCard(owner.agent, deck.id);
    await other.agent.post(`/api/decks/${deck.id}/cards`).send({ front: 'Q', back: 'A' }).expect(404);
    await other.agent.get(`/api/decks/${deck.id}/cards`).expect(404);
    await other.agent.get(`/api/cards/${card.id}`).expect(404);
    await other.agent.put(`/api/cards/${card.id}`).send({ front: 'Q', back: 'A' }).expect(404);
    await other.agent.delete(`/api/cards/${card.id}`).expect(404);
    await owner.agent.post(`/api/decks/${MISSING_ID}/cards`).send({ front: 'Q', back: 'A' }).expect(404);
    await owner.agent.get('/api/cards/123').expect(400);
  });

  it('adding, editing or deleting a card moves its deck to the top of the list', async () => {
    const { agent } = await signedInUser();
    const older = await createDeck(agent, 'Older');
    const card = await createCard(agent, older.id);
    await createDeck(agent, 'Newer');
    const order = async () =>
      contract(z.array(deckSummarySchema), (await agent.get('/api/decks').expect(200)).body).map((d) => d.title);
    expect(await order()).toEqual(['Newer', 'Older']);
    await agent.put(`/api/cards/${card.id}`).send({ front: 'edited', back: 'A' }).expect(200);
    expect(await order()).toEqual(['Older', 'Newer']);
  });
});
