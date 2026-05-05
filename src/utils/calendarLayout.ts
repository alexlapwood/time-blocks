export const PIXELS_PER_MINUTE = 1;
export const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE;
export const DAY_MINUTES = 24 * 60;
export const ROUND_MINUTES = 15;

export function clampMinutes(value: number) {
  return Math.max(0, Math.min(DAY_MINUTES - 1, value));
}

export function roundToStep(value: number, step = ROUND_MINUTES) {
  return Math.round(value / step) * step;
}

// Compute a scrollTop that places `targetMinutes` at the vertical centre of
// the viewport, clamped to the legal scroll range. Used by the routine
// canvas to default to "12pm in the middle" on open, mirroring the way the
// calendar pre-scrolls to "now".
export function centerScrollTopForMinute(input: {
  targetMinutes: number;
  viewportHeight: number;
  contentHeight: number;
}): number {
  const targetTop = input.targetMinutes * PIXELS_PER_MINUTE;
  const desired = targetTop - input.viewportHeight / 2;
  const maxScroll = Math.max(0, input.contentHeight - input.viewportHeight);
  return Math.max(0, Math.min(desired, maxScroll));
}
