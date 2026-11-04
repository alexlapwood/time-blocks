import { isEffectivelyDone, type CategoryId, type Task } from "../store/taskStore";
import type { CalendarSlot } from "./dragPreview";
import { toDate } from "./date";

const MINUTE_MS = 60_000;

export type NowNextBlock = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  slotType: "task" | "draft" | "external";
  category?: CategoryId;
};

export type NowNext =
  | { kind: "now"; block: NowNextBlock; minutesLeft: number }
  | { kind: "next"; block: NowNextBlock; minutesUntil: number }
  | null;

type NowNextResult = Exclude<NowNext, null>;
type BlockComparator = (a: NowNextBlock, b: NowNextBlock) => number;

const SLOT_TYPE_ORDER: Record<NowNextBlock["slotType"], number> = {
  task: 0,
  draft: 1,
  external: 2,
};

function indexTasksById(tasks: Task[], index = new Map<string, Task>()) {
  for (const task of tasks) {
    index.set(task.id, task);
    indexTasksById(task.subtasks, index);
  }
  return index;
}

export function toNowNextBlocks(
  slots: CalendarSlot[],
  tasks: Task[],
): NowNextBlock[] {
  const tasksById = indexTasksById(tasks);
  const blocks: NowNextBlock[] = [];
  for (const slot of slots) {
    const slotType = slot.slotType ?? "task";
    if (slotType === "preview") continue;
    if (slotType === "task") {
      const owner = tasksById.get(slot.taskId);
      if (owner && isEffectivelyDone(owner)) continue;
    }
    const startMs = toDate(slot.scheduledTime)?.getTime();
    if (startMs === undefined || Number.isNaN(startMs)) continue;
    blocks.push({
      id: slot.id,
      title: slot.title,
      start: new Date(startMs),
      end: new Date(startMs + slot.duration * MINUTE_MS),
      slotType,
      category: slot.category ?? undefined,
    });
  }
  return blocks;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const compareTypeThenId: BlockComparator = (a, b) =>
  SLOT_TYPE_ORDER[a.slotType] - SLOT_TYPE_ORDER[b.slotType] ||
  compareIds(a.id, b.id);

const compareCurrent: BlockComparator = (a, b) =>
  a.end.getTime() - b.end.getTime() ||
  a.start.getTime() - b.start.getTime() ||
  compareTypeThenId(a, b);

const compareUpcoming: BlockComparator = (a, b) =>
  a.start.getTime() - b.start.getTime() ||
  a.end.getTime() - b.end.getTime() ||
  compareTypeThenId(a, b);

function pickFirst(
  blocks: NowNextBlock[],
  compare: BlockComparator,
): NowNextBlock | null {
  let best: NowNextBlock | null = null;
  for (const candidate of blocks) {
    if (best === null || compare(candidate, best) < 0) best = candidate;
  }
  return best;
}

const minutesBetween = (fromMs: number, toMs: number) =>
  Math.ceil((toMs - fromMs) / MINUTE_MS);

export function pickNowNext(blocks: NowNextBlock[], now: Date): NowNext {
  const nowMs = now.getTime();
  const current = pickFirst(
    blocks.filter(
      (block) => block.start.getTime() <= nowMs && nowMs < block.end.getTime(),
    ),
    compareCurrent,
  );
  if (current) {
    return {
      kind: "now",
      block: current,
      minutesLeft: minutesBetween(nowMs, current.end.getTime()),
    };
  }

  const nextMidnightMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  const next = pickFirst(
    blocks.filter((block) => {
      const startMs = block.start.getTime();
      return startMs > nowMs && startMs < nextMidnightMs;
    }),
    compareUpcoming,
  );
  if (next) {
    return {
      kind: "next",
      block: next,
      minutesUntil: minutesBetween(nowMs, next.start.getTime()),
    };
  }

  return null;
}

export function formatCountdown(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

const countOf = (count: number, unit: string) =>
  `${count} ${unit}${count === 1 ? "" : "s"}`;

function formatDurationWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return countOf(rest, "minute");
  if (rest === 0) return countOf(hours, "hour");
  return `${countOf(hours, "hour")} ${countOf(rest, "minute")}`;
}

export function formatNowNextText(result: NowNextResult): string {
  return result.kind === "now"
    ? formatCountdown(result.minutesLeft)
    : `in ${formatCountdown(result.minutesUntil)}`;
}

export function formatNowNextLabel(result: NowNextResult): string {
  return result.kind === "now"
    ? `Now: ${result.block.title}, ${formatDurationWords(result.minutesLeft)} left. Show in calendar.`
    : `Next: ${result.block.title}, in ${formatDurationWords(result.minutesUntil)}. Show in calendar.`;
}
