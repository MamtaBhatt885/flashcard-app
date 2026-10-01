import type { CardInput } from '@flashcards/shared';
import { prisma } from '../../lib/prisma.js';
import { cardSelect } from './card.mapper.js';

// Ownership is enforced inside each statement (WHERE … AND deck.userId = ?), not by a separate
// lookup first, so there's no gap between "is it yours?" and "change it".
// Writes list their fields explicitly: a client can set front/back, never deckId or the schedule.
export const cardsRepository = {
  deckIsOwned(userId: string, deckId: string) {
    return prisma.deck.count({ where: { id: deckId, userId } }).then((n) => n > 0);
  },

  listInDeck(deckId: string) {
    return prisma.card.findMany({ where: { deckId }, orderBy: { createdAt: 'asc' }, select: cardSelect });
  },

  findOwned(userId: string, cardId: string) {
    return prisma.card.findFirst({ where: { id: cardId, deck: { userId } }, select: cardSelect });
  },

  async create(deckId: string, { front, back }: CardInput) {
    const [card] = await prisma.$transaction([
      prisma.card.create({ data: { front, back, deckId }, select: cardSelect }),
      // Adding a card counts as updating the deck (sorts it to the top of "my decks").
      prisma.deck.update({ where: { id: deckId }, data: { updatedAt: new Date() }, select: { id: true } }),
    ]);
    return card;
  },

  /**
   * Ownership-scoped update (throws P2025 if not found/not owned). The nested write bumps the
   * parent deck's updatedAt in the same transaction: editing a card counts as updating the deck,
   * just like adding one does, so "my decks" ordering is consistent.
   */
  update(userId: string, cardId: string, { front, back }: CardInput) {
    return prisma.card.update({
      where: { id: cardId, deck: { userId } },
      data: { front, back, deck: { update: { updatedAt: new Date() } } },
      select: cardSelect,
    });
  },

  /** Ownership-scoped delete (throws P2025 if not found/not owned); also bumps the deck's updatedAt. */
  remove(userId: string, cardId: string) {
    return prisma.$transaction(async (tx) => {
      const { deckId } = await tx.card.delete({ where: { id: cardId, deck: { userId } }, select: { deckId: true } });
      await tx.deck.update({ where: { id: deckId }, data: { updatedAt: new Date() }, select: { id: true } });
    });
  },
};
