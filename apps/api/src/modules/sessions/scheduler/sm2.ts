/**
 * SM-2 spaced-repetition algorithm (Wozniak, 1987), as a pure function.
 *
 * quality: 0–5 self-rating of recall.
 *   < 3  → forgotten: restart the repetition streak, see it again tomorrow.
 *   >= 3 → remembered: interval grows 1 day → 6 days → previous × ease factor.
 * The ease factor adapts to how hard the card is for this user and never drops below 1.3.
 *
 * `maxEase` optionally caps the ease factor. Used with binary Correct/Incorrect grading so that
 * ease can recover after a miss without growing without bound (see sessions.service.ts).
 */
export interface Schedule {
  easeFactor: number;
  interval: number; // days
  repetitions: number; // consecutive successful reviews
}

export const MIN_EASE = 1.3;
/** SM-2's starting ease for a new card. */
export const DEFAULT_EASE = 2.5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function sm2(
  prev: Schedule,
  quality: number,
  now: Date = new Date(),
  { maxEase = Infinity }: { maxEase?: number } = {},
): Schedule & { dueAt: Date } {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`quality must be an integer 0–5, got ${quality}`);
  }

  let repetitions: number;
  let interval: number;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = prev.repetitions + 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(prev.interval * prev.easeFactor);
  }

  const q = 5 - quality;
  const easeFactor = Math.min(maxEase, Math.max(MIN_EASE, round2(prev.easeFactor + (0.1 - q * (0.08 + q * 0.02)))));

  return { easeFactor, interval, repetitions, dueAt: new Date(now.getTime() + interval * DAY_MS) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
