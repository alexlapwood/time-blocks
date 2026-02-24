import { createSignal } from "solid-js";
import type { Task, CategoryId } from "./taskStore";

export type DragOverList = {
  kind: "list";
  listId: string;
  itemId: string | null;
  placement: "before" | "after" | "end";
  depth: number;
};

export type DragOverCalendar = {
  kind: "calendar";
  date: string;
  minutes: number;
};

export type DragOver = DragOverList | DragOverCalendar | null;

export type CalendarDragData = {
  id: string;
  title: string;
  category?: CategoryId | null;
  scheduledTime?: Date | string;
  duration?: number;
  taskId?: string;
  slotId?: string;
};

export type DragData = Task | CalendarDragData;

export type DragSource =
  | {
      kind: "list";
      listId: string;
    }
  | {
      kind: "calendar";
      date?: string;
    }
  | null;

export type DragRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DropAnimation = {
  task: Task;
  from: DragRect;
  to: DragRect | null;
  kind: "list" | "calendar" | "cancel";
};

export const [activeDragId, setActiveDragId] = createSignal<string | null>(
  null,
);
export const [activeDragData, setActiveDragData] = createSignal<DragData | null>(
  null,
);
export const [dragPosition, setDragPosition] = createSignal<{
  x: number;
  y: number;
} | null>(null);
export const [dragOffset, setDragOffset] = createSignal<{
  x: number;
  y: number;
} | null>(null);
export const [dragSize, setDragSize] = createSignal<{
  width: number;
  height: number;
} | null>(null);
export const [dragOver, setDragOver] = createSignal<DragOver>(null);
export const [isDragging, setIsDragging] = createSignal(false);
export const [dragSource, setDragSource] = createSignal<DragSource>(null);
export const [dropAnimation, setDropAnimation] =
  createSignal<DropAnimation | null>(null);export function clearDragState() {
  setActiveDragId(null);
  setActiveDragData(null);
  setDragPosition(null);
  setDragOffset(null);
  setDragSize(null);
  setDragOver(null);
  setIsDragging(false);
  setDragSource(null);
}export function clearDropAnimation() {
  setDropAnimation(null);
}
