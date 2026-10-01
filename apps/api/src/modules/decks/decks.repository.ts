import type { DeckInput } from '@flashcards/shared';
import { prisma } from '../../lib/prisma.js';
import { cardSelect } from '../cards/card.mapper.js';

const deckFields = { id: true, title: true, description: true, updatedAt: true } as const;

// Every query is scoped by userId, so one user can never read or change another user's decks.
// Writes are single statements with the ownership filter IN the WHERE clause (no find-then-write),
// and they list their fields explicitly (no `...input` spreads).
export const decksRepository = {
  /** 1 query regardless of deck count (cards are counted in SQL, not loaded). */
  listWithCardCounts(userId: string) {
    return prisma.deck.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { ...deckFields, _count: { select: { cards: true } } },
    });
  },

  /** 1 query: due counts for all of the user's decks at once (no per-deck loop). */
  dueCountsByDeck(userId: string, now: Date) {
    return prisma.card.groupBy({
      by: ['deckId'],
      where: { deck: { userId }, dueAt: { lte: now } },
      _count: { _all: true },
    });
  },

  findOwned(userId: string, deckId: string) {
    return prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { ...deckFields, cards: { select: cardSelect, orderBy: { createdAt: 'asc' } } },
    });
  },

  /** Card and due counts for one deck, without loading its cards. */
  async counts(deckId: string, now: Date) {
    const [cardCount, dueCount] = await Promise.all([
      prisma.card.count({ where: { deckId } }),
      prisma.card.count({ where: { deckId, dueAt: { lte: now } } }),
    ]);
    return { cardCount, dueCount };
  },

  /** Throws P2002 if the title is taken: the database constraint is the single source of truth. */
  create(userId: string, { title, description }: DeckInput) {
    return prisma.deck.create({ data: { title, description: description ?? null, userId }, select: deckFields });
  },

  /**
   * One atomic statement: UPDATE … WHERE id = ? AND userId = ?.
   * Throws P2025 if not found/not owned, P2002 if the new title is taken.
   * PUT replaces the deck: an omitted description means "cleared", not "unchanged".
   */
  update(userId: string, deckId: string, { title, description }: DeckInput) {
    return prisma.deck.update({
      where: { id: deckId, userId },
      data: { title, description: description ?? null },
      select: deckFields,
    });
  },

  /** DELETE … WHERE id = ? AND userId = ?. Throws P2025 if not found/not owned. */
  remove(userId: string, deckId: string) {
    return prisma.deck.delete({ where: { id: deckId, userId }, select: { id: true } });
  },
};
