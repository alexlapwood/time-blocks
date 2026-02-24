export type ScheduleItem = {
  id: string;
  startMinutes: number;
  duration: number;
};

export function resolveSchedule(
  items: ScheduleItem[],
  priorityId?: string,
) {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    if (a.startMinutes === b.startMinutes && priorityId) {
      if (a.id === priorityId) return -1;
      if (b.id === priorityId) return 1;
    }
    return a.startMinutes - b.startMinutes;
  });

  const fixedIndex =
    priorityId != null ? sorted.findIndex((item) => item.id === priorityId) : -1;

  if (fixedIndex === -1) {
    let prevEnd = sorted[0].startMinutes + sorted[0].duration;
    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      if (current.startMinutes < prevEnd) {
        current.startMinutes = prevEnd;
      }
      prevEnd = current.startMinutes + current.duration;
    }
    return sorted;
  }

  // Forward pass (tasks after the priority item)
  let prevEnd =
    sorted[fixedIndex].startMinutes + sorted[fixedIndex].duration;
  for (let i = fixedIndex + 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current.startMinutes < prevEnd) {
      current.startMinutes = prevEnd;
    }
    prevEnd = current.startMinutes + current.duration;
  }

  // Backward pass (tasks before the priority item)
  let nextStart = sorted[fixedIndex].startMinutes;
  for (let i = fixedIndex - 1; i >= 0; i -= 1) {
    const current = sorted[i];
    const originalEnd = current.startMinutes + current.duration;
    const end = Math.min(originalEnd, nextStart);
    let start = end - current.duration;
    if (start < 0) {
      start = 0;
    }
    current.startMinutes = start;
    nextStart = start;
  }

  return sorted;
}
