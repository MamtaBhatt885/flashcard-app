import type { DeckDetail, DeckInput, DeckSummary } from '@flashcards/shared';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { isRecordNotFound, isUniqueViolation } from '../../lib/prismaErrors.js';
import { toCardDto } from '../cards/card.mapper.js';
import { decksRepository as repo } from './decks.repository.js';

/** Translate database outcomes into domain errors with messages the user can act on. */
function deckWriteError(err: unknown, title?: string): never {
  if (isUniqueViolation(err)) throw new ConflictError(`You already have a deck named “${title}”`);
  if (isRecordNotFound(err)) throw new NotFoundError('Deck');
  throw err;
}

export const decksService = {
  /** 2 queries total, however many decks the user has. */
  async list(userId: string): Promise<DeckSummary[]> {
    const now = new Date();
    const [decks, due] = await Promise.all([repo.listWithCardCounts(userId), repo.dueCountsByDeck(userId, now)]);
    const dueByDeck = new Map(due.map((d) => [d.deckId, d._count._all]));
    return decks.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      cardCount: d._count.cards,
      dueCount: dueByDeck.get(d.id) ?? 0,
      updatedAt: d.updatedAt.toISOString(),
    }));
  },

  async get(userId: string, deckId: string): Promise<DeckDetail> {
    const deck = await repo.findOwned(userId, deckId);
    if (!deck) throw new NotFoundError('Deck');
    const now = Date.now();
    return {
      id: deck.id,
      title: deck.title,
      description: deck.description,
      cardCount: deck.cards.length,
      dueCount: deck.cards.filter((c) => c.dueAt.getTime() <= now).length,
      updatedAt: deck.updatedAt.toISOString(),
      cards: deck.cards.map(toCardDto),
    };
  },

  /** 1 query: insert, letting the unique constraint detect duplicates (no racy pre-check). */
  async create(userId: string, input: DeckInput): Promise<DeckDetail> {
    const deck = await repo.create(userId, input).catch((err) => deckWriteError(err, input.title));
    return { ...deck, updatedAt: deck.updatedAt.toISOString(), cardCount: 0, dueCount: 0, cards: [] };
  },

  /** Returns the deck summary (counts, no card list): renaming a deck shouldn't ship every card back. */
  async update(userId: string, deckId: string, input: DeckInput): Promise<DeckSummary> {
    const deck = await repo.update(userId, deckId, input).catch((err) => deckWriteError(err, input.title));
    const counts = await repo.counts(deckId, new Date());
    return { ...deck, updatedAt: deck.updatedAt.toISOString(), ...counts };
  },

  async remove(userId: string, deckId: string): Promise<void> {
    await repo.remove(userId, deckId).catch((err) => deckWriteError(err));
  },
};
