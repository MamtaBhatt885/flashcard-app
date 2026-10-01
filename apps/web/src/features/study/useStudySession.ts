import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useAnswerCard, useCompleteSession, useStartSession } from './hooks';
import {
  initialStudyState,
  selectCurrent,
  selectIsFinished,
  selectProgress,
  selectScore,
  studyReducer,
} from './studyReducer';

export type StudyStatus = 'loading' | 'error' | 'empty' | 'studying' | 'finished';

/**
 * Everything a study page needs, in one hook:
 * - starts a StudySession on the server (POST /decks/:id/sessions), which returns the due cards
 * - runs the session locally with useReducer(studyReducer)
 * - records each Correct/Incorrect as an Answer, and completes the session at the end
 * - exposes derived values (status, current card, progress, score) and actions
 */
export function useStudySession(deckId: string) {
  const [state, dispatch] = useReducer(studyReducer, initialStudyState);
  const startSession = useStartSession(deckId);
  const answerCard = useAnswerCard();
  const completeSession = useCompleteSession(deckId);

  /** In-flight answer saves, so "complete" is only sent after every answer has landed. */
  const pendingAnswers = useRef(new Set<Promise<unknown>>());
  const completed = useRef(new Set<string>());
  const startedFor = useRef<string | null>(null);

  const { mutate: start } = startSession;

  // Start one session per deck visit. The ref survives React StrictMode's double effect run,
  // so development doesn't create two sessions.
  useEffect(() => {
    if (startedFor.current === deckId) return;
    startedFor.current = deckId;
    start({}, { onSuccess: ({ session, cards }) => dispatch({ type: 'start', sessionId: session?.id ?? null, cards }) });
  }, [deckId, start]);

  const current = selectCurrent(state);
  const isFinished = selectIsFinished(state);
  const { mutateAsync: saveAnswer } = answerCard;
  const { mutate: complete } = completeSession;

  const flip = useCallback(() => dispatch({ type: 'flip' }), []);
  const skip = useCallback(() => dispatch({ type: 'skip' }), []);

  const answer = useCallback(
    (correct: boolean) => {
      if (!current || !state.flipped || !state.sessionId) return;
      const p = saveAnswer({ sessionId: state.sessionId, cardId: current.id, correct }).catch(() => {
        /* surfaced via answerCard.error */
      });
      pendingAnswers.current.add(p);
      void p.finally(() => pendingAnswers.current.delete(p));
      dispatch({ type: 'answer', correct }); // move on immediately; the save happens in the background
    },
    [current, state.flipped, state.sessionId, saveAnswer],
  );

  // When the last card is done: wait for outstanding answer saves, then complete the session once.
  useEffect(() => {
    const id = state.sessionId;
    if (!isFinished || !id || completed.current.has(id)) return;
    completed.current.add(id);
    void Promise.allSettled([...pendingAnswers.current]).then(() => complete({ sessionId: id, skipped: state.skipped }));
  }, [isFinished, state.sessionId, state.skipped, complete]);

  const practiceMissed = useCallback(() => {
    const cardIds = state.missed.map((c) => c.id);
    start(
      { practice: true, cardIds },
      { onSuccess: ({ session, cards }) => dispatch({ type: 'start', sessionId: session?.id ?? null, cards, practice: true }) },
    );
  }, [state.missed, start]);

  let status: StudyStatus;
  if (startSession.isError) status = 'error';
  else if (!state.started || startSession.isPending) status = 'loading';
  else if (state.total === 0) status = 'empty';
  else if (isFinished) status = 'finished';
  else status = 'studying';

  return {
    status,
    loadError: startSession.error,
    saveError: answerCard.error ?? completeSession.error,
    sessionId: state.sessionId,
    current,
    flipped: state.flipped,
    practice: state.practice,
    isRetry: current ? state.retried.includes(current.id) : false,
    missed: state.missed,
    progress: selectProgress(state),
    score: selectScore(state),
    flip,
    answer,
    skip,
    practiceMissed,
  };
}
