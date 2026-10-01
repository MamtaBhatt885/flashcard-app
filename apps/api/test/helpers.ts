import type { Card, DeckDetail, User } from '@flashcards/shared';
import request from 'supertest';
import type { z } from 'zod';
import { createApp } from '../src/app.js';

export const app = createApp();
export const MISSING_ID = '01999999-9999-7999-8999-999999999999';

let counter = 0;
/** A fresh user with a logged-in agent (the agent keeps the auth cookie between requests). */
export async function signedInUser(label = 'user') {
  const agent = request.agent(app);
  const email = `${label}-${process.pid}-${Date.now()}-${counter++}@test.dev`;
  const res = await agent.post('/api/auth/signup').send({ email, password: 'password123' }).expect(201);
  return { agent, email, user: res.body as User };
}

export type Agent = Awaited<ReturnType<typeof signedInUser>>['agent'];

export async function createDeck(agent: Agent, title = `Deck ${counter++}`, description?: string) {
  const res = await agent.post('/api/decks').send({ title, description }).expect(201);
  return res.body as DeckDetail;
}

export async function createCard(agent: Agent, deckId: string, front = `Q${counter++}`, back = 'A') {
  const res = await agent.post(`/api/decks/${deckId}/cards`).send({ front, back }).expect(201);
  return res.body as Card;
}

/** Asserts a response body matches its shared contract (and returns it typed). */
export function contract<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error(`Contract violation: ${JSON.stringify(parsed.error.issues)}`);
  return parsed.data;
}
