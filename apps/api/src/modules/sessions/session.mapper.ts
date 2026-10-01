import type { SessionDetail, SessionSummary, StudySession } from '@flashcards/shared';
import type { Answer as AnswerRow, StudySession as SessionRow } from '../../generated/prisma/client.js';

export type AnswerCounts = { correct: number; incorrect: number };

export function toSessionDto(s: SessionRow): StudySession {
  return {
    id: s.id,
    deckId: s.deckId,
    practice: s.practice,
    cardCount: s.cardCount,
    skipped: s.skipped,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
  };
}

export function toSummaryDto(s: SessionRow, counts: AnswerCounts): SessionSummary {
  return { ...toSessionDto(s), ...counts };
}

export function toDetailDto(s: SessionRow & { answers: Omit<AnswerRow, 'sessionId'>[] }): SessionDetail {
  const correct = s.answers.filter((a) => a.correct).length;
  return {
    ...toSummaryDto(s, { correct, incorrect: s.answers.length - correct }),
    answers: s.answers.map((a) => ({
      id: a.id,
      cardId: a.cardId,
      correct: a.correct,
      answeredAt: a.answeredAt.toISOString(),
    })),
  };
}
