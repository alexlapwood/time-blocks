import type { Task } from "../store/taskStore";
import {
  activeDragData,
  dragOffset,
  dragPosition,
  dragSize,
  dragSource,
  setDropAnimation,
} from "../store/dragStore";
import type { DragRect } from "../store/dragStore";

export const DROP_ANIMATION_DURATION = 220;
export const DROP_ANIMATION_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const isTask = (value: unknown): value is Task =>
  !!value && typeof value === "object" && "scheduledTimes" in value;

export function getDragOverlayRect(): DragRect | null {
  const position = dragPosition();
  const offset = dragOffset();
  const size = dragSize();
  if (!position || !offset || !size) return null;
  return {
    left: position.x - offset.x,
    top: position.y - offset.y,
    width: size.width,
    height: size.height,
  };
}

export function getTaskRect(taskId: string): DragRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-flip-id="${taskId}"]`);
  if (!el) return null;
  const card = el.querySelector<HTMLElement>('[data-task-card="true"]') ?? el;
  const rect = card.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function animateListDrop(update: () => void) {
  if (dragSource()?.kind !== "list") {
    update();
    return;
  }
  const task = activeDragData();
  const from = getDragOverlayRect();
  const shouldAnimate =
    !!task && isTask(task) && !!from && !prefersReducedMotion();
  if (shouldAnimate) {
    setDropAnimation({ task, from, to: null, kind: "list" });
  }
  update();

  if (!shouldAnimate || !task || !isTask(task) || !from) return;

  requestAnimationFrame(() => {
    const to = getTaskRect(task.id);
    if (!to) {
      setDropAnimation(null);
      return;
    }
    setDropAnimation({ task, from, to, kind: "list" });
  });
}

export function animateCalendarDrop(update: () => void) {
  if (dragSource()?.kind !== "list") {
    update();
    return;
  }
  const task = activeDragData();
  const from = getDragOverlayRect();
  const shouldAnimate =
    !!task && isTask(task) && !!from && !prefersReducedMotion();
  if (shouldAnimate) {
    setDropAnimation({ task, from, to: null, kind: "calendar" });
  }
  update();

  if (!shouldAnimate || !task || !isTask(task) || !from) return;

  setDropAnimation({ task, from, to: from, kind: "calendar" });
}

export function animateDropCancel(task: Task | null, from: DragRect | null) {
  const shouldAnimate = !!task && !!from && !prefersReducedMotion();
  if (!shouldAnimate || !task || !from) return;
  setDropAnimation({ task, from, to: null, kind: "cancel" });

  requestAnimationFrame(() => {
    const to = getTaskRect(task.id);
    if (!to) {
      setDropAnimation(null);
      return;
    }
    setDropAnimation({ task, from, to, kind: "cancel" });
  });
}
