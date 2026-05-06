import {
  ceilToFifteen,
  stampRoutine,
  type StampingConflict,
} from "./routineStamping";
import type {
  CategoryId,
  PriorityLevel,
  RoutineItem,
} from "../store/taskStore";
import { buildDateAtMinutes, getMinutesInDay } from "./date";

export type RoutinePreviewSlot = {
  id: string;
  templateItemId: string;
  title: string;
  category: CategoryId | null;
  description: string;
  dueDate: string | null;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  start: Date;
  duration: number;
};

export type PreviewRoutineForDayInput = {
  date: Date;
  now: Date;
  weeklyTemplate: RoutineItem[];
  conflicts: StampingConflict[];
  isStarted: boolean;
};

export const ROUTINE_PREVIEW_ID_PREFIX = "routine-preview";

export function previewRoutineSlotId(
  templateItemId: string,
  dateId: string,
): string {
  return `${ROUTINE_PREVIEW_ID_PREFIX}:${templateItemId}:${dateId}`;
}

// Inverse of `previewRoutineSlotId`. Returns the date id encoded into a
// preview slot id (the trailing `YYYY-MM-DD` segment), or null if the id
// does not have the preview shape. The template item id may itself contain
// hyphens, so we anchor on the prefix and the trailing date.
export function previewSlotIdToDateId(slotId: string): string | null {
  const prefix = `${ROUTINE_PREVIEW_ID_PREFIX}:`;
  if (!slotId.startsWith(prefix)) return null;
  const rest = slotId.slice(prefix.length);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon === -1) return null;
  return rest.slice(lastColon + 1);
}

function formatDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function previewRoutineForDay(
  input: PreviewRoutineForDayInput,
): RoutinePreviewSlot[] {
  const dateId = formatDateId(input.date);
  const todayId = formatDateId(input.now);

  if (dateId < todayId) return [];

  // A day is "started" when at least one templated draft slot exists for
  // it. That can happen on today (via the Start day button) AND on any
  // future day (via mutating one of its preview tiles). Either way, no
  // preview should render alongside the now-real committed tiles.
  if (input.isStarted) return [];

  const isToday = dateId === todayId;

  const nowFloorMinutes = isToday
    ? ceilToFifteen(getMinutesInDay(input.now))
    : 0;

  const stamps = stampRoutine({
    items: input.weeklyTemplate.map((item) => ({
      id: item.id,
      startMinutes: item.startMinutes,
      duration: item.duration,
      homeDay: item.homeDay,
      repeatDays: item.repeatDays,
    })),
    todayWeekday: input.date.getDay(),
    nowFloorMinutes,
    conflicts: input.conflicts,
  });

  return stamps.map((stamp) => {
    const source = input.weeklyTemplate.find(
      (item) => item.id === stamp.templateItemId,
    );
    const title = source?.title.trim() ? source.title.trim() : "New slot";
    return {
      id: previewRoutineSlotId(stamp.templateItemId, dateId),
      templateItemId: stamp.templateItemId,
      title,
      category: source?.category ?? null,
      description: source?.description ?? "",
      dueDate: source?.dueDate ?? null,
      importance: source?.importance ?? "none",
      urgency: source?.urgency ?? "none",
      start: buildDateAtMinutes(input.date, stamp.startMinutes),
      duration: stamp.duration,
    };
  });
}
