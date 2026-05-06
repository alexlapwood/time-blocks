import { DAY_MINUTES } from "./calendarLayout";

export type RoutineItemTemplate = {
  id: string;
  startMinutes: number;
  duration: number;
  homeDay: number;
  repeatDays?: number[];
};

export type StampingConflict = {
  startMinutes: number;
  duration: number;
};

export type StampedSlot = {
  templateItemId: string;
  startMinutes: number;
  duration: number;
};

export type StampRoutineInput = {
  items: RoutineItemTemplate[];
  todayWeekday: number;
  nowFloorMinutes: number;
  conflicts: StampingConflict[];
};

function isItemForToday(
  item: RoutineItemTemplate,
  todayWeekday: number,
): boolean {
  if (item.homeDay === todayWeekday) return true;
  return Boolean(item.repeatDays?.includes(todayWeekday));
}

function groupIntoWaves(items: RoutineItemTemplate[]): RoutineItemTemplate[][] {
  const waves: RoutineItemTemplate[][] = [];
  for (const item of items) {
    const last = waves[waves.length - 1];
    const lastItem = last?.[last.length - 1];
    const isContiguous =
      lastItem !== undefined &&
      lastItem.startMinutes + lastItem.duration === item.startMinutes;
    if (isContiguous) {
      last.push(item);
    } else {
      waves.push([item]);
    }
  }
  return waves;
}

function findFreeStart(
  start: number,
  duration: number,
  conflicts: StampingConflict[],
): number {
  let candidate = start;
  let pushed = true;
  while (pushed) {
    pushed = false;
    for (const conflict of conflicts) {
      const conflictEnd = conflict.startMinutes + conflict.duration;
      const candidateEnd = candidate + duration;
      const overlaps =
        conflict.startMinutes < candidateEnd && conflictEnd > candidate;
      if (overlaps) {
        candidate = conflictEnd;
        pushed = true;
      }
    }
  }
  return candidate;
}

export function stampRoutine(input: StampRoutineInput): StampedSlot[] {
  const todayItems = input.items
    .filter((item) => isItemForToday(item, input.todayWeekday))
    .slice()
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const waves = groupIntoWaves(todayItems);
  const stamps: StampedSlot[] = [];
  let prevWaveEnd = input.nowFloorMinutes;

  for (let i = 0; i < waves.length; i += 1) {
    const wave = waves[i];
    const templateAnchor = wave[0].startMinutes;
    const desiredAnchor =
      i === 0
        ? Math.max(input.nowFloorMinutes, templateAnchor)
        : Math.max(templateAnchor, prevWaveEnd);

    let cursor = desiredAnchor;
    for (const item of wave) {
      const placement = findFreeStart(cursor, item.duration, input.conflicts);
      if (placement + item.duration > DAY_MINUTES) {
        continue;
      }
      stamps.push({
        templateItemId: item.id,
        startMinutes: placement,
        duration: item.duration,
      });
      cursor = placement + item.duration;
    }
    prevWaveEnd = cursor;
  }

  return stamps;
}

export function ceilToFifteen(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}
