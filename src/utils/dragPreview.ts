import type { Task, CategoryId } from "../store/taskStore";
import type { DragOver, DragOverList, DragSource } from "../store/dragStore";
import { clampMinutes, roundToStep } from "./calendarLayout";
import {
  buildDateAtMinutes,
  formatLocalDate,
  getMinutesInDay,
  toDate,
} from "./date";
import { resolveSchedule } from "./calendarSchedule";

export const DRAG_PREVIEW_ID = "__drag-preview__";
const DEFAULT_SLOT_DURATION = 30;

export type FlatTask = {
  task: Task;
  depth: number;
};

export function flattenTasks(tasks: Task[], depth = 0): FlatTask[] {
  const result: FlatTask[] = [];
  for (const task of tasks) {
    result.push({ task, depth });
    if (!task.isCollapsed && task.subtasks.length > 0) {
      result.push(...flattenTasks(task.subtasks, depth + 1));
    }
  }
  return result;
}

export function removeFlatSubtree(
  flatTasks: FlatTask[],
  taskId: string,
): { filtered: FlatTask[]; originalIndex: number; originalDepth: number } {
  const idx = flatTasks.findIndex((ft) => ft.task.id === taskId);
  if (idx === -1)
    return { filtered: flatTasks, originalIndex: -1, originalDepth: 0 };
  const depth = flatTasks[idx].depth;
  let endIdx = idx + 1;
  while (endIdx < flatTasks.length && flatTasks[endIdx].depth > depth) {
    endIdx++;
  }
  return {
    filtered: [...flatTasks.slice(0, idx), ...flatTasks.slice(endIdx)],
    originalIndex: idx,
    originalDepth: depth,
  };
}

export function buildFlatListWithPreview(
  flatTasks: FlatTask[],
  activeId: string | null,
  activeTask: Task | null,
  over: DragOver | null,
  listId: string,
  dragging: boolean,
  source: DragSource,
): FlatTask[] {
  if (source?.kind === "calendar") return flatTasks;

  const isSourceList = source?.kind === "list" && source.listId === listId;
  let base = flatTasks;
  let originalIndex = -1;
  let originalDepth = 0;

  if (isSourceList && activeId) {
    const result = removeFlatSubtree(flatTasks, activeId);
    base = result.filtered;
    originalIndex = result.originalIndex;
    originalDepth = result.originalDepth;
  }

  if (!dragging || !activeTask) return base;

  if (over && over.kind === "list" && over.listId === listId) {
    const depth = over.depth ?? 0;
    const ghostTask: FlatTask = {
      task: { ...activeTask, id: DRAG_PREVIEW_ID } as Task,
      depth,
    };
    const insertIndex = over.itemId
      ? computeFlatDropIndex(base, over)
      : base.length;
    const next = base.slice();
    next.splice(insertIndex, 0, ghostTask);
    return next;
  }

  if (isSourceList && (!over || over.kind !== "list")) {
    const ghostTask: FlatTask = {
      task: { ...activeTask, id: DRAG_PREVIEW_ID } as Task,
      depth: originalDepth,
    };
    const safeIndex =
      originalIndex < 0 ? base.length : Math.min(originalIndex, base.length);
    const next = base.slice();
    next.splice(safeIndex, 0, ghostTask);
    return next;
  }

  return base;
}

export function computeFlatDropIndex(
  flatTasks: FlatTask[],
  over: DragOverList,
): number {
  if (!over.itemId) return flatTasks.length;
  const targetIndex = flatTasks.findIndex(
    (ft) => ft.task.id === over.itemId,
  );
  if (targetIndex === -1) return flatTasks.length;
  return over.placement === "before" ? targetIndex : targetIndex + 1;
}

export function resolveDropParent(
  flatTasks: FlatTask[],
  insertPosition: number,
  depth: number,
): { parentId: string | undefined; childIndex: number } {
  if (depth === 0) {
    let rootCount = 0;
    for (let i = 0; i < insertPosition && i < flatTasks.length; i++) {
      if (flatTasks[i].depth === 0) rootCount++;
    }
    return { parentId: undefined, childIndex: rootCount };
  }

  let parentId: string | undefined;
  let parentFlatIndex = -1;
  for (let i = insertPosition - 1; i >= 0; i--) {
    if (flatTasks[i].depth === depth - 1) {
      parentId = flatTasks[i].task.id;
      parentFlatIndex = i;
      break;
    }
    if (flatTasks[i].depth < depth - 1) break;
  }

  if (parentId === undefined) {
    return { parentId: undefined, childIndex: 0 };
  }

  let childIndex = 0;
  for (
    let i = parentFlatIndex + 1;
    i < insertPosition && i < flatTasks.length;
    i++
  ) {
    if (flatTasks[i].depth === depth) childIndex++;
  }

  return { parentId, childIndex };
}

export type CalendarSlot = {
  id: string;
  taskId: string;
  slotType?: "task" | "draft" | "external";
  title: string;
  category?: CategoryId | null;
  scheduledTime: Date | string;
  duration: number;
};

export type CalendarPreviewTask = CalendarSlot & {
  __ghost?: boolean;
  __displayTime?: Date;
  __displayDuration?: number;
  overlapType?: "left" | "right";
};

export type ResizePreview = {
  slotId: string;
  date: string;
  duration: number;
  startMinutes?: number;
};

export function computeDropIndex(
  tasks: Task[],
  draggedId: string,
  over: DragOverList,
) {
  const filtered = tasks.filter((task) => task.id !== draggedId);
  if (!over.itemId) return filtered.length;
  const targetIndex = filtered.findIndex((task) => task.id === over.itemId);
  if (targetIndex === -1) return filtered.length;
  return over.placement === "before" ? targetIndex : targetIndex + 1;
}

export function buildListWithPreview(
  tasks: Task[],
  activeId: string | null,
  activeTask: Task | null,
  over: DragOver | null,
  listId: string,
  dragging: boolean,
  source: DragSource,
) {
  if (source?.kind === "calendar") return tasks;

  const isSourceList = source?.kind === "list" && source.listId === listId;
  const originalIndex =
    isSourceList && activeId
      ? tasks.findIndex((task) => task.id === activeId)
      : -1;
  const base =
    isSourceList && activeId
      ? tasks.filter((task) => task.id !== activeId)
      : tasks;
  if (!dragging || !activeTask) return base;

  const ghostTask = {
    ...activeTask,
    id: DRAG_PREVIEW_ID,
  } as Task;

  if (over && over.kind === "list" && over.listId === listId) {
    const insertIndex = over.itemId
      ? computeDropIndex(base, activeId ?? "", over)
      : base.length;
    const next = base.slice();
    next.splice(insertIndex, 0, ghostTask);
    return next;
  }

  if (isSourceList && (!over || over.kind !== "list")) {
    const next = base.slice();
    const safeIndex =
      originalIndex < 0 ? base.length : Math.min(originalIndex, base.length);
    next.splice(safeIndex, 0, ghostTask);
    return next;
  }

  return base;
}

export function buildCalendarPreviewTasks(
  dayTasks: CalendarSlot[],
  activeId: string | null,
  activeTask: Task | CalendarSlot | null,
  over: DragOver | null,
  dayDate: Date,
  dragging: boolean,
  source: DragSource,
  resizePreview?: ResizePreview | null,
) {
  const dateStr = formatLocalDate(dayDate);
  const base: CalendarPreviewTask[] = dayTasks
    .filter((slot) => {
      if (
        dragging &&
        source?.kind === "calendar" &&
        activeId &&
        over?.kind === "calendar"
      ) {
        return slot.id !== activeId;
      }
      return true;
    })
    .map((slot) => {
      const time = toDate(slot.scheduledTime);
      return {
        ...slot,
        __displayTime: time ?? undefined,
      };
    });

  const getPreviewDuration = () => {
    if (!activeTask) return DEFAULT_SLOT_DURATION;
    if ("scheduledTimes" in activeTask) {
      return DEFAULT_SLOT_DURATION;
    }
    if ("duration" in activeTask && typeof activeTask.duration === "number") {
      return activeTask.duration || DEFAULT_SLOT_DURATION;
    }
    return DEFAULT_SLOT_DURATION;
  };

  const shouldResolveOverlaps =
    dragging &&
    activeTask &&
    over &&
    over.kind === "calendar" &&
    over.date === dateStr;

  const shouldApplyResize =
    !dragging && resizePreview && resizePreview.date === dateStr;
  const resizeTask = shouldApplyResize
    ? base.find((task) => task.id === resizePreview.slotId)
    : undefined;
  if (resizeTask && resizePreview) {
    resizeTask.__displayDuration = resizePreview.duration;
    if (resizePreview.startMinutes != null) {
      resizeTask.__displayTime = buildDateAtMinutes(
        dayDate,
        resizePreview.startMinutes,
      );
    }
  }

  if (shouldResolveOverlaps) {
    const rounded = clampMinutes(roundToStep(over.minutes));
    const previewTime = new Date(dayDate);
    previewTime.setHours(Math.floor(rounded / 60), rounded % 60, 0, 0);
    const ghostTaskId =
      activeTask && "taskId" in activeTask ? activeTask.taskId : activeTask.id;
    const ghostCategory =
      activeTask && "scheduledTimes" in activeTask
        ? (activeTask.category ?? null)
        : "category" in activeTask
          ? (activeTask.category ?? null)
          : null;
    const ghostSlotType =
      activeTask && "scheduledTimes" in activeTask
        ? "task"
        : "slotType" in activeTask && activeTask.slotType === "draft"
          ? "draft"
          : "task";
    base.push({
      id: DRAG_PREVIEW_ID,
      taskId: ghostTaskId,
      slotType: ghostSlotType,
      title: activeTask.title,
      category: ghostCategory,
      scheduledTime: previewTime,
      duration: getPreviewDuration(),
      __ghost: true,
      __displayTime: previewTime,
    });
  }

  if (shouldResolveOverlaps || resizeTask) {
    const priorityId = shouldResolveOverlaps ? DRAG_PREVIEW_ID : resizeTask?.id;
    const internalTasks = base.filter((t) => t.slotType !== "external");
    const schedule = internalTasks.map((task) => {
      const time = toDate(task.__displayTime ?? task.scheduledTime);
      const startMinutes = time ? getMinutesInDay(time) : 0;
      return {
        id: task.id,
        startMinutes,
        duration:
          task.__displayDuration ?? task.duration ?? DEFAULT_SLOT_DURATION,
      };
    });

    const resolved = resolveSchedule(schedule, priorityId);
    const byId = new Map(resolved.map((item) => [item.id, item.startMinutes]));

    for (const task of base) {
      const minutes = byId.get(task.id);
      if (minutes === undefined) continue;
      task.__displayTime = buildDateAtMinutes(dayDate, minutes);
    }

    base.sort((a, b) => {
      const timeA = toDate(a.__displayTime ?? a.scheduledTime)?.getTime() ?? 0;
      const timeB = toDate(b.__displayTime ?? b.scheduledTime)?.getTime() ?? 0;
      return timeA - timeB;
    });
  }

  return base;
}
