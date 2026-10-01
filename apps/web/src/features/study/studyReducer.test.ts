import type { Card } from '@flashcards/shared';
import { describe, expect, it } from 'vitest';
import {
  initialStudyState,
  selectCurrent,
  selectIsFinished,
  selectProgress,
  selectScore,
  studyReducer,
  type StudyAction,
  type StudyState,
} from './studyReducer';

const card = (id: string): Card => ({
  id,
  deckId: 'd1',
  front: `Q${id}`,
  back: `A${id}`,
  interval: 0,
  repetitions: 0,
  easeFactor: 2.5,
  dueAt: '2026-01-01T00:00:00.000Z',
});

const run = (actions: StudyAction[], from: StudyState = initialStudyState) => actions.reduce(studyReducer, from);
const started = (ids: string[]) => run([{ type: 'start', sessionId: 's1', cards: ids.map(card) }]);
const ids = (s: StudyState) => s.queue.map((c) => c.id);

describe('studyReducer', () => {
  it('start: loads the queue and resets counters', () => {
    const s = started(['1', '2', '3']);
    expect(s).toMatchObject({ started: true, sessionId: 's1', total: 3, flipped: false, correct: 0, practice: false });
    expect(selectCurrent(s)?.id).toBe('1');
    expect(selectProgress(s)).toEqual({ done: 0, total: 3, position: 1, percent: 0 });
  });

  it('flip toggles the card', () => {
    const s = run([{ type: 'flip' }, { type: 'flip' }], started(['1']));
    expect(s.flipped).toBe(false);
    expect(run([{ type: 'flip' }], started(['1'])).flipped).toBe(true);
  });

  it('ignores answers before the card is flipped', () => {
    const before = started(['1', '2']);
    expect(studyReducer(before, { type: 'answer', correct: true })).toBe(before);
  });

  it('correct: removes the card, counts it, un-flips', () => {
    const s = run([{ type: 'flip' }, { type: 'answer', correct: true }], started(['1', '2']));
    expect(ids(s)).toEqual(['2']);
    expect(s).toMatchObject({ correct: 1, incorrect: 0, flipped: false });
    expect(selectProgress(s)).toMatchObject({ done: 1, position: 2, percent: 50 });
  });

  it('incorrect: sends the card to the back once and records it as missed', () => {
    const s = run([{ type: 'flip' }, { type: 'answer', correct: false }], started(['1', '2']));
    expect(ids(s)).toEqual(['2', '1']);
    expect(s.incorrect).toBe(1);
    expect(s.missed.map((c) => c.id)).toEqual(['1']);
    expect(s.retried).toEqual(['1']);
  });

  it('a second miss on the same card moves on, so the session never gets stuck', () => {
    const miss: StudyAction[] = [{ type: 'flip' }, { type: 'answer', correct: false }];
    const s = run([...miss, ...miss], started(['1']));
    expect(s.queue).toHaveLength(0);
    expect(selectIsFinished(s)).toBe(true);
    expect(s.incorrect).toBe(2);
    expect(s.missed).toHaveLength(1); // listed once in the summary
  });

  it('skip: moves on without scoring', () => {
    const s = run([{ type: 'skip' }], started(['1', '2']));
    expect(ids(s)).toEqual(['2']);
    expect(s).toMatchObject({ skipped: 1, correct: 0, incorrect: 0 });
  });

  it('actions on an empty or finished session are no-ops', () => {
    const done = run([{ type: 'skip' }], started(['1']));
    for (const a of [{ type: 'flip' }, { type: 'skip' }, { type: 'answer', correct: true }] as StudyAction[]) {
      expect(studyReducer(done, a)).toBe(done);
    }
    expect(selectIsFinished(initialStudyState)).toBe(false); // not started ≠ finished
  });

  it('score: percent of answered cards (skips excluded)', () => {
    const s = run(
      [
        { type: 'flip' }, { type: 'answer', correct: true },
        { type: 'flip' }, { type: 'answer', correct: true },
        { type: 'flip' }, { type: 'answer', correct: false },
        { type: 'skip' },
      ],
      started(['1', '2', '3', '4']),
    );
    expect(selectScore(s)).toEqual({ correct: 2, incorrect: 1, skipped: 1, percent: 67 });
  });

  it('practice run: restarts with only the missed cards and a fresh score', () => {
    const first = run([{ type: 'flip' }, { type: 'answer', correct: false }, { type: 'skip' }, { type: 'skip' }], started(['1', '2']));
    expect(selectIsFinished(first)).toBe(true);
    const practice = studyReducer(first, { type: 'start', sessionId: 's2', cards: first.missed, practice: true });
    expect(practice).toMatchObject({ sessionId: 's2', practice: true, total: 1, correct: 0, incorrect: 0, missed: [] });
    expect(ids(practice)).toEqual(['1']);
  });

  it('does not mutate the previous state', () => {
    const before = started(['1', '2']);
    const snapshot = structuredClone(before);
    run([{ type: 'flip' }, { type: 'answer', correct: false }], before);
    expect(before).toEqual(snapshot);
  });

  // ---- added in the critique pass ----
  it('skipping a card you already missed still keeps it in the summary’s "to review" list', () => {
    const s = run([{ type: 'flip' }, { type: 'answer', correct: false }, { type: 'skip' }, { type: 'skip' }], started(['1', '2']));
    // queue after the miss: [2, 1]; skip 2, skip 1 → done
    expect(selectIsFinished(s)).toBe(true);
    expect(s.missed.map((c) => c.id)).toEqual(['1']);
    expect(selectScore(s)).toMatchObject({ correct: 0, incorrect: 1, skipped: 2 });
  });

  it('skipping while the answer is showing un-flips the next card', () => {
    const s = run([{ type: 'flip' }, { type: 'skip' }], started(['1', '2']));
    expect(s.flipped).toBe(false);
    expect(selectCurrent(s)?.id).toBe('2');
  });

  it('progress never goes backwards when a missed card is re-queued', () => {
    const s = run([{ type: 'flip' }, { type: 'answer', correct: false }], started(['1', '2']));
    expect(selectProgress(s)).toMatchObject({ done: 0, position: 1 });
  });
});
