import { describe, expect, it } from 'vitest';
import { DEFAULT_EASE, MIN_EASE, sm2, type Schedule } from './sm2.js';

const NEW_CARD: Schedule = { easeFactor: 2.5, interval: 0, repetitions: 0 };
const NOW = new Date('2026-01-01T00:00:00Z');
const daysAfterNow = (d: Date) => (d.getTime() - NOW.getTime()) / 86_400_000;

describe('sm2', () => {
  it('schedules a new card 1 day out after a correct answer', () => {
    const next = sm2(NEW_CARD, 4, NOW);
    expect(next).toMatchObject({ repetitions: 1, interval: 1, easeFactor: 2.5 });
    expect(daysAfterNow(next.dueAt)).toBe(1);
  });

  it('grows the interval 1 → 6 → interval × ease on consecutive successes', () => {
    const r1 = sm2(NEW_CARD, 4, NOW);
    const r2 = sm2(r1, 4, NOW);
    const r3 = sm2(r2, 4, NOW);
    expect([r1.interval, r2.interval, r3.interval]).toEqual([1, 6, 15]); // 6 × 2.5
  });

  it('resets the streak but keeps a lowered ease when the card is forgotten', () => {
    const learned: Schedule = { easeFactor: 2.5, interval: 15, repetitions: 3 };
    const next = sm2(learned, 1, NOW);
    expect(next.repetitions).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.easeFactor).toBeCloseTo(1.96);
  });

  it('raises ease on "easy" and lowers it on "hard"', () => {
    expect(sm2(NEW_CARD, 5, NOW).easeFactor).toBeCloseTo(2.6);
    expect(sm2(NEW_CARD, 3, NOW).easeFactor).toBeCloseTo(2.36);
  });

  it('never lets ease fall below the 1.3 floor', () => {
    let s: Schedule = NEW_CARD;
    for (let i = 0; i < 20; i++) s = sm2(s, 0, NOW);
    expect(s.easeFactor).toBe(MIN_EASE);
  });

  it('rejects ratings outside 0–5', () => {
    expect(() => sm2(NEW_CARD, 6, NOW)).toThrow(RangeError);
    expect(() => sm2(NEW_CARD, 2.5, NOW)).toThrow(RangeError);
  });

  describe('binary Correct/Incorrect grading (how the app uses it)', () => {
    const CORRECT = 5;
    const INCORRECT = 1;
    const opts = { maxEase: DEFAULT_EASE };
    const t0 = NOW;

    it('BEFORE: grading Correct as quality 4 traps a card in "ease hell" after one miss', () => {
      let s: Schedule = sm2(NEW_CARD, INCORRECT, t0);
      for (let i = 0; i < 20; i++) s = sm2(s, 4, t0);
      expect(s.easeFactor).toBeCloseTo(1.96); // 20 correct answers later: unchanged, never recovers
    });

    it('AFTER: Correct = quality 5 lets ease recover after a miss…', () => {
      let s: Schedule = sm2(NEW_CARD, INCORRECT, t0); // 1.96
      for (let i = 0; i < 3; i++) s = sm2(s, CORRECT, t0, opts);
      expect(s.easeFactor).toBeCloseTo(2.26);
    });

    it('…but never above the default ease, so easy cards don’t balloon', () => {
      let s: Schedule = NEW_CARD;
      for (let i = 0; i < 30; i++) s = sm2(s, CORRECT, t0, opts);
      expect(s.easeFactor).toBe(DEFAULT_EASE);
    });
  });
});
