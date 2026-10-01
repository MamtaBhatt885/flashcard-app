import type { Card } from '@flashcards/shared';

/**
 * Pure state machine for one study session: no React, no network, so it's trivially testable.
 * The queue's first card is the current card.
 */
export interface StudyState {
  started: boolean;
  /** Server-side StudySession id; null when nothing was due (no session created). */
  sessionId: string | null;
  /** Practice runs (re-studying missed cards) don't send reviews to the server. */
  practice: boolean;
  queue: Card[];
  total: number;
  flipped: boolean;
  correct: number;
  incorrect: number;
  skipped: number;
  /** Ids already sent back once. A second miss moves on, so a session can't loop forever. */
  retried: string[];
  /** Cards answered incorrectly at least once, for the end summary. */
  missed: Card[];
}

export type StudyAction =
  | { type: 'start'; sessionId: string | null; cards: Card[]; practice?: boolean }
  | { type: 'flip' }
  | { type: 'answer'; correct: boolean }
  | { type: 'skip' };

export const initialStudyState: StudyState = {
  started: false,
  sessionId: null,
  practice: false,
  queue: [],
  total: 0,
  flipped: false,
  correct: 0,
  incorrect: 0,
  skipped: 0,
  retried: [],
  missed: [],
};

export function studyReducer(state: StudyState, action: StudyAction): StudyState {
  const [current, ...rest] = state.queue;

  switch (action.type) {
    case 'start':
      return {
        ...initialStudyState,
        started: true,
        sessionId: action.sessionId,
        practice: action.practice ?? false,
        queue: action.cards,
        total: action.cards.length,
      };

    case 'flip':
      if (!current) return state;
      return { ...state, flipped: !state.flipped };

    case 'answer': {
      // You can only grade yourself after seeing the answer.
      if (!current || !state.flipped) return state;
      if (action.correct) {
        return { ...state, queue: rest, flipped: false, correct: state.correct + 1 };
      }
      const retry = !state.retried.includes(current.id);
      const alreadyMissed = state.missed.some((c) => c.id === current.id);
      return {
        ...state,
        queue: retry ? [...rest, current] : rest,
        retried: retry ? [...state.retried, current.id] : state.retried,
        missed: alreadyMissed ? state.missed : [...state.missed, current],
        flipped: false,
        incorrect: state.incorrect + 1,
      };
    }

    case 'skip':
      if (!current) return state;
      return { ...state, queue: rest, flipped: false, skipped: state.skipped + 1 };
  }
}

/* ---------- Selectors (derived values, computed on read) ---------- */

export const selectCurrent = (s: StudyState): Card | undefined => s.queue[0];

export const selectIsFinished = (s: StudyState) => s.started && s.total > 0 && s.queue.length === 0;

export function selectProgress(s: StudyState) {
  const done = s.total - s.queue.length;
  return {
    done,
    total: s.total,
    /** 1-based number of the card being shown, e.g. "Card 3 of 10". */
    position: Math.min(done + 1, s.total),
    percent: s.total ? Math.round((done / s.total) * 100) : 0,
  };
}

export function selectScore(s: StudyState) {
  const answered = s.correct + s.incorrect;
  return {
    correct: s.correct,
    incorrect: s.incorrect,
    skipped: s.skipped,
    percent: answered ? Math.round((s.correct / answered) * 100) : 0,
  };
}
