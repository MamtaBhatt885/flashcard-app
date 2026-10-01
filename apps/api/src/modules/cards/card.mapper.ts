import type { Card } from '@flashcards/shared';
import type { Prisma } from '../../generated/prisma/client.js';

/** Exactly the columns the API returns for a card: every card query selects this, never `*`. */
export const cardSelect = {
  id: true,
  deckId: true,
  front: true,
  back: true,
  interval: true,
  repetitions: true,
  easeFactor: true,
  dueAt: true,
} satisfies Prisma.CardSelect;

export type CardRow = Prisma.CardGetPayload<{ select: typeof cardSelect }>;

/** Database row → API shape (dates as ISO strings). */
export function toCardDto(c: CardRow): Card {
  return {
    id: c.id,
    deckId: c.deckId,
    front: c.front,
    back: c.back,
    interval: c.interval,
    repetitions: c.repetitions,
    easeFactor: c.easeFactor,
    dueAt: c.dueAt.toISOString(),
  };
}
