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
