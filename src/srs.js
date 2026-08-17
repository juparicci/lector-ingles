// SM-2 spaced repetition algorithm.
// quality: 0-5 (we use a simplified 3-button UI mapped to quality scores)
export const QUALITY = {
  AGAIN: 1,
  GOOD: 3,
  EASY: 5,
};

export function sm2(srs, quality) {
  let { interval, repetitions, easeFactor } = srs;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    interval,
    repetitions,
    easeFactor,
    nextReview: nextReview.toISOString(),
    lastReviewed: new Date().toISOString(),
  };
}
