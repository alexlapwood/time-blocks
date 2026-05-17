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

export type RoutinePreviewItemOverride = {
  deleted?: boolean;
  startMinutes?: number;
  duration?: number;
};

export type RoutinePreviewInsert = {
  id: string;
  title: string;
  category: CategoryId | null;
  description: string;
  dueDate: string | null;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  startMinutes: number;
  duration: number;
  sourceTemplateItemId?: string;
};

export type RoutinePreviewOverridesForDate = {
  itemOverrides: Record<string, RoutinePreviewItemOverride>;
  inserts: RoutinePreviewInsert[];
};

export type PreviewRoutineForDayInput = {
  date: Date;
  now: Date;
  weeklyTemplate: RoutineItem[];
  conflicts: StampingConflict[];
  isStarted: boolean;
  overrides?: RoutinePreviewOverridesForDate;
};

export const ROUTINE_PREVIEW_ID_PREFIX = "routine-preview";
export const ROUTINE_PREVIEW_INSERT_ID_PREFIX = "routine-preview-ins";

export function previewRoutineSlotId(
  templateItemId: string,
  dateId: string,
): string {
  return `${ROUTINE_PREVIEW_ID_PREFIX}:${templateItemId}:${dateId}`;
}

export function previewInsertSlotId(insertId: string, dateId: string): string {
  return `${ROUTINE_PREVIEW_INSERT_ID_PREFIX}:${insertId}:${dateId}`;
}

export type ParsedPreviewSlotId =
  | { kind: "template"; templateItemId: string; dateId: string }
  | { kind: "insert"; insertId: string; dateId: string };

// Parses a preview slot id into its kind, inner id, and trailing date id.
// The insert prefix is checked first because it is more specific (the
// template prefix is a strict prefix of the insert prefix).
export function parsePreviewSlotId(slotId: string): ParsedPreviewSlotId | null {
  const insertPrefix = `${ROUTINE_PREVIEW_INSERT_ID_PREFIX}:`;
  const templatePrefix = `${ROUTINE_PREVIEW_ID_PREFIX}:`;

  let kind: "template" | "insert";
  let rest: string;
  if (slotId.startsWith(insertPrefix)) {
    kind = "insert";
    rest = slotId.slice(insertPrefix.length);
  } else if (slotId.startsWith(templatePrefix)) {
    kind = "template";
    rest = slotId.slice(templatePrefix.length);
  } else {
    return null;
  }

  const lastColon = rest.lastIndexOf(":");
  if (lastColon === -1) return null;
  const innerId = rest.slice(0, lastColon);
  const dateId = rest.slice(lastColon + 1);
  if (!innerId || !dateId) return null;

  if (kind === "insert") {
    return { kind: "insert", insertId: innerId, dateId };
  }
  return { kind: "template", templateItemId: innerId, dateId };
}

// Inverse of `previewRoutineSlotId` / `previewInsertSlotId`. Returns the
// date id encoded into a preview slot id (the trailing `YYYY-MM-DD`
// segment), or null if the id does not have either preview shape. The
// template/insert id may itself contain hyphens, so we anchor on the
// prefix and the trailing date.
export function previewSlotIdToDateId(slotId: string): string | null {
  const parsed = parsePreviewSlotId(slotId);
  return parsed ? parsed.dateId : null;
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

  const itemOverrides = input.overrides?.itemOverrides ?? {};

  const filteredTemplate = input.weeklyTemplate.filter(
    (item) => !itemOverrides[item.id]?.deleted,
  );

  const stamps = stampRoutine({
    items: filteredTemplate.map((item) => {
      const override = itemOverrides[item.id];
      return {
        id: item.id,
        startMinutes: override?.startMinutes ?? item.startMinutes,
        duration: override?.duration ?? item.duration,
        homeDay: item.homeDay,
        repeatDays: item.repeatDays,
      };
    }),
    todayWeekday: input.date.getDay(),
    nowFloorMinutes,
    conflicts: input.conflicts,
  });

  const stampedSlots = stamps.map((stamp) => {
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

  const inserts = input.overrides?.inserts ?? [];
  const insertSlots: RoutinePreviewSlot[] = inserts.map((insert) => ({
    id: previewInsertSlotId(insert.id, dateId),
    templateItemId:
      insert.sourceTemplateItemId && insert.sourceTemplateItemId.length > 0
        ? insert.sourceTemplateItemId
        : `insert:${insert.id}`,
    title: insert.title,
    category: insert.category,
    description: insert.description,
    dueDate: insert.dueDate,
    importance: insert.importance,
    urgency: insert.urgency,
    start: buildDateAtMinutes(input.date, insert.startMinutes),
    duration: insert.duration,
  }));

  return [...stampedSlots, ...insertSlots];
}
