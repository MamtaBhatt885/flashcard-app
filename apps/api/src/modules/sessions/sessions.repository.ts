import { prisma } from '../../lib/prisma.js';
import { cardSelect } from '../cards/card.mapper.js';
import type { AnswerCounts } from './session.mapper.js';
import type { Schedule } from './scheduler/sm2.js';

export const sessionsRepository = {
  deckIsOwned(userId: string, deckId: string) {
    return prisma.deck.count({ where: { id: deckId, userId } }).then((n) => n > 0);
  },

  dueCards(deckId: string, now: Date, limit: number) {
    return prisma.card.findMany({
      where: { deckId, dueAt: { lte: now } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      select: cardSelect,
    });
  },

  /** The given cards restricted to this deck (1 query, IN list), in the order requested. */
  async cardsInDeck(deckId: string, cardIds: string[]) {
    const cards = await prisma.card.findMany({ where: { deckId, id: { in: cardIds } }, select: cardSelect });
    const byId = new Map(cards.map((c) => [c.id, c]));
    return cardIds.flatMap((id) => byId.get(id) ?? []);
  },

  create({ userId, deckId, practice, cardCount }: { userId: string; deckId: string; practice: boolean; cardCount: number }) {
    return prisma.studySession.create({ data: { userId, deckId, practice, cardCount } });
  },

  listForDeck(deckId: string, limit: number) {
    return prisma.studySession.findMany({ where: { deckId }, orderBy: { startedAt: 'desc' }, take: limit });
  },

  /**
   * Correct/incorrect counts for many sessions in ONE query (GROUP BY sessionId, correct),
   * instead of loading every answer row, or worse, counting per session in a loop (N+1).
   */
  async answerCounts(sessionIds: string[]): Promise<Map<string, AnswerCounts>> {
    const groups = await prisma.answer.groupBy({
      by: ['sessionId', 'correct'],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    });
    const counts = new Map(sessionIds.map((id) => [id, { correct: 0, incorrect: 0 }]));
    for (const g of groups) counts.get(g.sessionId)![g.correct ? 'correct' : 'incorrect'] = g._count._all;
    return counts;
  },

  findOwned(userId: string, sessionId: string) {
    return prisma.studySession.findFirst({ where: { id: sessionId, userId } });
  },

  findOwnedWithAnswers(userId: string, sessionId: string) {
    return prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      include: {
        answers: { select: { id: true, cardId: true, correct: true, answeredAt: true }, orderBy: { answeredAt: 'asc' } },
      },
    });
  },

  findCardInDeck(cardId: string, deckId: string) {
    return prisma.card.findFirst({ where: { id: cardId, deckId }, select: cardSelect });
  },

  countAnswersForCard(sessionId: string, cardId: string) {
    return prisma.answer.count({ where: { sessionId, cardId } });
  },

  /** Stores the answer and, if given, the card's new schedule, atomically. */
  async recordAnswer(sessionId: string, cardId: string, correct: boolean, next: (Schedule & { dueAt: Date }) | null) {
    const createAnswer = prisma.answer.create({ data: { sessionId, cardId, correct } });
    if (!next) return { answer: await createAnswer, card: null };
    const { easeFactor, interval, repetitions, dueAt } = next;
    const [answer, card] = await prisma.$transaction([
      createAnswer,
      prisma.card.update({ where: { id: cardId }, data: { easeFactor, interval, repetitions, dueAt }, select: cardSelect }),
    ]);
    return { answer, card };
  },

  complete(sessionId: string, skipped: number) {
    return prisma.studySession.update({ where: { id: sessionId }, data: { completedAt: new Date(), skipped } });
  },
};
