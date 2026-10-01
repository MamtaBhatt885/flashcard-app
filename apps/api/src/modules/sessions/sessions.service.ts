import {
  MAX_ANSWERS_PER_CARD,
  MAX_SESSION_CARDS,
  type AnswerInput,
  type Card,
  type CompleteSessionInput,
  type SessionAnswer,
  type SessionDetail,
  type SessionSummary,
  type StartSessionResponse,
  type startSessionSchema,
} from '@flashcards/shared';
import type { z } from 'zod';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { toCardDto } from '../cards/card.mapper.js';
import { DEFAULT_EASE, sm2 } from './scheduler/sm2.js';
import { toDetailDto, toSessionDto, toSummaryDto } from './session.mapper.js';
import { sessionsRepository as repo } from './sessions.repository.js';

// Correct/Incorrect mapped onto the SM-2 0–5 quality scale.
// Correct is 5, not the "obvious" 4: in SM-2, quality 4 leaves the ease factor unchanged while a miss
// lowers it, so with only two buttons ease could never recover ("ease hell"). Quality 5 raises ease
// by +0.1 per correct answer; capping it at the default (2.5) stops easy cards from ballooning.
const QUALITY = { correct: 5, incorrect: 1 } as const;
const SCHEDULE_OPTIONS = { maxEase: DEFAULT_EASE };
const HISTORY_LIMIT = 20;

async function assertDeckOwned(userId: string, deckId: string) {
  if (!(await repo.deckIsOwned(userId, deckId))) throw new NotFoundError('Deck');
}

export const sessionsService = {
  async start(userId: string, deckId: string, input: z.output<typeof startSessionSchema>): Promise<StartSessionResponse> {
    await assertDeckOwned(userId, deckId);

    let cards;
    if (input.practice) {
      const ids = input.cardIds ?? [];
      cards = await repo.cardsInDeck(deckId, ids);
      // Don't silently drop ids from another deck (or that don't exist).
      if (cards.length !== ids.length) throw new NotFoundError('Card');
    } else {
      cards = await repo.dueCards(deckId, new Date(), MAX_SESSION_CARDS);
    }

    // Nothing due: don't create an empty session.
    if (cards.length === 0) return { session: null, cards: [] };

    const session = await repo.create({ userId, deckId, practice: input.practice, cardCount: cards.length });
    return { session: toSessionDto(session), cards: cards.map(toCardDto) };
  },

  /** 2 queries total: the sessions, then all their answer counts via one GROUP BY. */
  async listForDeck(userId: string, deckId: string): Promise<SessionSummary[]> {
    await assertDeckOwned(userId, deckId);
    const sessions = await repo.listForDeck(deckId, HISTORY_LIMIT);
    const counts = await repo.answerCounts(sessions.map((s) => s.id));
    return sessions.map((s) => toSummaryDto(s, counts.get(s.id)!));
  },

  async get(userId: string, sessionId: string): Promise<SessionDetail> {
    const session = await repo.findOwnedWithAnswers(userId, sessionId);
    if (!session) throw new NotFoundError('Session');
    return toDetailDto(session);
  },

  /**
   * Rules that stop the scheduler from being gamed by replaying requests:
   * - a card may be answered at most twice per session (first try + one retry) → 409
   * - only the FIRST answer reschedules the card; the retry is recorded for stats only
   * - in a normal session, the card must have been due when the session started → 409
   * - practice sessions never reschedule
   */
  async answer(
    userId: string,
    sessionId: string,
    { cardId, correct }: AnswerInput,
  ): Promise<{ answer: SessionAnswer; card: Card }> {
    const session = await repo.findOwned(userId, sessionId);
    if (!session) throw new NotFoundError('Session');
    if (session.completedAt) throw new ConflictError('This session is already finished');

    const [card, previousAnswers] = await Promise.all([
      repo.findCardInDeck(cardId, session.deckId),
      repo.countAnswersForCard(session.id, cardId),
    ]);
    if (!card) throw new NotFoundError('Card');
    if (previousAnswers >= MAX_ANSWERS_PER_CARD) {
      throw new ConflictError('This card was already answered in this session');
    }
    const isFirstAnswer = previousAnswers === 0;
    if (!session.practice && isFirstAnswer && card.dueAt > session.startedAt) {
      throw new ConflictError('This card wasn’t due when the session started');
    }

    const next =
      !session.practice && isFirstAnswer
        ? sm2(card, correct ? QUALITY.correct : QUALITY.incorrect, new Date(), SCHEDULE_OPTIONS)
        : null;
    const saved = await repo.recordAnswer(session.id, card.id, correct, next);
    return {
      answer: { id: saved.answer.id, cardId, correct, answeredAt: saved.answer.answeredAt.toISOString() },
      card: toCardDto(saved.card ?? card), // unchanged card is already in memory: no re-read
    };
  },

  /** Idempotent: completing an already-completed session returns it unchanged (200, not 409). */
  async complete(userId: string, sessionId: string, { skipped }: CompleteSessionInput): Promise<SessionDetail> {
    const existing = await repo.findOwned(userId, sessionId);
    if (!existing) throw new NotFoundError('Session');
    if (!existing.completedAt) {
      if (skipped > existing.cardCount) {
        const cards = `${existing.cardCount} ${existing.cardCount === 1 ? 'card' : 'cards'}`;
        throw new BadRequestError('Invalid input', { skipped: [`Can't skip more than the ${cards} in this session`] });
      }
      await repo.complete(sessionId, skipped);
    }
    return this.get(userId, sessionId);
  },
};
