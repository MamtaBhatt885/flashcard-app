import type { Card, CardInput } from '@flashcards/shared';
import { NotFoundError } from '../../lib/errors.js';
import { isRecordNotFound } from '../../lib/prismaErrors.js';
import { toCardDto } from './card.mapper.js';
import { cardsRepository as repo } from './cards.repository.js';

async function assertDeckOwned(userId: string, deckId: string) {
  if (!(await repo.deckIsOwned(userId, deckId))) throw new NotFoundError('Deck');
}

const cardNotFound = (err: unknown): never => {
  if (isRecordNotFound(err)) throw new NotFoundError('Card');
  throw err;
};

export const cardsService = {
  async list(userId: string, deckId: string): Promise<Card[]> {
    await assertDeckOwned(userId, deckId);
    return (await repo.listInDeck(deckId)).map(toCardDto);
  },

  async get(userId: string, cardId: string): Promise<Card> {
    const card = await repo.findOwned(userId, cardId);
    if (!card) throw new NotFoundError('Card');
    return toCardDto(card);
  },

  async create(userId: string, deckId: string, input: CardInput): Promise<Card> {
    await assertDeckOwned(userId, deckId);
    return toCardDto(await repo.create(deckId, input));
  },

  /** 1 query (was 2: find, then update). */
  async update(userId: string, cardId: string, input: CardInput): Promise<Card> {
    return toCardDto(await repo.update(userId, cardId, input).catch(cardNotFound));
  },

  /** 1 query (was 2: find, then delete). */
  async remove(userId: string, cardId: string): Promise<void> {
    await repo.remove(userId, cardId).catch(cardNotFound);
  },
};
