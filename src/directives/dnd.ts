import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import {
  activeDragData,
  activeDragId,
  clearDragState,
  dragOver,
  dragOffset,
  dragSource,
  setDragSource,
  setActiveDragData,
  setActiveDragId,
  setDragOffset,
  setDragOver,
  setDragPosition,
  setDragSize,
  setIsDragging,
} from "../store/dragStore";
import type { DragOver, DragSource } from "../store/dragStore";
import type { Task } from "../store/taskStore";
import {
  clampMinutes,
  roundToStep,
  PIXELS_PER_MINUTE,
} from "../utils/calendarLayout";
import { animateDropCancel, getDragOverlayRect } from "../utils/dropAnimation";

export type DropInfo = {
  over: DragOver | null;
};

type DroppableKind = "list" | "calendar-day";

type DroppableConfig = {
  id: string;
  kind: DroppableKind;
  onDrop?: (itemId: string, info: DropInfo) => void;
};

const droppableRegistry = new WeakMap<HTMLElement, DroppableConfig>();
const listDropTargets = new Set<HTMLElement>();
let activeDropElement: HTMLElement | null = null;

const DRAG_THRESHOLD = 4;
let pendingDrag: {
  id: string;
  data?: any;
  source: DragSource;
  offset: { x: number; y: number };
  size: { width: number; height: number };
  startX: number;
  startY: number;
} | null = null;

let pointerId: number | null = null;
let previousUserSelect = "";

const isTask = (value: unknown): value is Task =>
  !!value && typeof value === "object" && "scheduledTimes" in value;

function getNextRealItem(el: HTMLElement): HTMLElement | null {
  let next = el.nextElementSibling as HTMLElement | null;
  while (next) {
    if (next.dataset.dropKind === "item" && !next.hasAttribute("data-preview"))
      return next;
    next = next.nextElementSibling as HTMLElement | null;
  }
  return null;
}

function getPrevRealItem(el: HTMLElement): HTMLElement | null {
  let prev = el.previousElementSibling as HTMLElement | null;
  while (prev) {
    if (prev.dataset.dropKind === "item" && !prev.hasAttribute("data-preview"))
      return prev;
    prev = prev.previousElementSibling as HTMLElement | null;
  }
  return null;
}

const INDENT_PX = 24;

function computeDepthFromX(
  cardLeftX: number,
  listEl: HTMLElement,
  itemEl: HTMLElement,
  placement: "before" | "after",
): number {
  const listRect = listEl.getBoundingClientRect();
  const baseLeft = listRect.left + 16;
  const relX = cardLeftX - baseLeft;

  const itemDepth = parseInt(itemEl.dataset.taskDepth ?? "0");

  let aboveDepth: number;
  let belowDepth: number;

  if (placement === "after") {
    aboveDepth = itemDepth;
    const nextItem = getNextRealItem(itemEl);
    belowDepth = nextItem ? parseInt(nextItem.dataset.taskDepth ?? "0") : 0;
  } else {
    const prevItem = getPrevRealItem(itemEl);
    aboveDepth = prevItem ? parseInt(prevItem.dataset.taskDepth ?? "0") : -1;
    belowDepth = itemDepth;
  }

  const maxDepth = aboveDepth + 1;
  const minDepth = Math.max(0, belowDepth);

  if (minDepth > maxDepth) return maxDepth;

  const rawDepth = Math.floor(relX / INDENT_PX);
  return Math.max(minDepth, Math.min(rawDepth, maxDepth));
}

function resolveDropTarget(x: number, y: number) {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) {
    setDragOver(null);
    activeDropElement = null;
    return;
  }

  const resolveCalendarOver = (
    dayEl: HTMLElement,
    clampY: boolean,
    setDropElement: boolean,
  ) => {
    const date = dayEl.dataset.dropId;
    if (!date) return false;
    const rect = dayEl.getBoundingClientRect();
    const rawOffset = y - rect.top;
    const yOffset = clampY
      ? Math.max(0, Math.min(rawOffset, rect.height))
      : rawOffset;
    const offset = dragOffset()?.y ?? 0;
    const rawMinutes = (yOffset - offset) / PIXELS_PER_MINUTE;
    const minutes = clampMinutes(roundToStep(rawMinutes));
    setDragOver({
      kind: "calendar",
      date,
      minutes,
    });
    activeDropElement = setDropElement ? dayEl : null;
    return true;
  };

  if (dragSource()?.kind === "calendar") {
    const dayEl = el.closest(
      '[data-drop-kind="calendar-day"]',
    ) as HTMLElement | null;
    if (dayEl && resolveCalendarOver(dayEl, false, true)) return;

    const calendarZone = document.querySelector(
      '[data-drop-kind="calendar-zone"]',
    ) as HTMLElement | null;
    if (calendarZone) {
      const dayEls = Array.from(
        calendarZone.querySelectorAll('[data-drop-kind="calendar-day"]'),
      ) as HTMLElement[];
      if (dayEls.length > 0) {
        let closest: HTMLElement | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const candidate of dayEls) {
          const rect = candidate.getBoundingClientRect();
          let distance = 0;
          if (x < rect.left) distance = rect.left - x;
          else if (x > rect.right) distance = x - rect.right;
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = candidate;
          }
        }
        if (closest && resolveCalendarOver(closest, true, true)) return;
      }
    }

    setDragOver(null);
    activeDropElement = null;
    return;
  }

  const resolveListDrop = (listEl: HTMLElement) => {
    const listId = listEl.dataset.dropId;
    if (!listId) return false;
    const items = Array.from(
      listEl.querySelectorAll(
        `[data-drop-kind="item"][data-drop-list="${CSS.escape(listId)}"]:not([data-preview])`,
      ),
    ) as HTMLElement[];
    if (items.length > 0) {
      let closestItem = items[0];
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const distance = Math.abs(y - midpoint);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestItem = item;
        }
      }

      const rect = closestItem.getBoundingClientRect();
      const placement = y < rect.top + rect.height / 2 ? "before" : "after";
      const itemId = closestItem.dataset.dropId ?? null;
      const cardLeftX = x - (dragOffset()?.x ?? 0);
      const depth = computeDepthFromX(
        cardLeftX,
        listEl,
        closestItem,
        placement,
      );
      setDragOver({
        kind: "list",
        listId,
        itemId,
        placement,
        depth,
      });
    } else {
      setDragOver({
        kind: "list",
        listId,
        itemId: null,
        placement: "end",
        depth: 0,
      });
    }
    activeDropElement = listEl;
    return true;
  };

  const itemEl = el.closest('[data-drop-kind="item"]') as HTMLElement | null;
  if (itemEl) {
    const listId = itemEl.dataset.dropList;
    const itemId = itemEl.dataset.dropId;
    if (listId && itemId) {
      const rect = itemEl.getBoundingClientRect();
      const placement: "before" | "after" =
        y < rect.top + rect.height / 2 ? "before" : "after";
      const listContainer =
        (itemEl.closest('[data-drop-kind="list"]') as HTMLElement | null) ??
        null;
      const itemCardLeftX = x - (dragOffset()?.x ?? 0);
      const depth = listContainer
        ? computeDepthFromX(itemCardLeftX, listContainer, itemEl, placement)
        : 0;
      setDragOver({
        kind: "list",
        listId,
        itemId,
        placement,
        depth,
      });
      activeDropElement = listContainer;
      return;
    }
  }

  const listEl = el.closest('[data-drop-kind="list"]') as HTMLElement | null;
  if (listEl) {
    if (resolveListDrop(listEl)) return;
  }

  const dayEl = el.closest(
    '[data-drop-kind="calendar-day"]',
  ) as HTMLElement | null;
  if (dayEl) {
    if (resolveCalendarOver(dayEl, false, true)) return;
  }

  const calendarZone = el.closest(
    '[data-drop-kind="calendar-zone"]',
  ) as HTMLElement | null;
  if (calendarZone) {
    setDragOver(null);
    activeDropElement = null;
    return;
  }

  const regionEl =
    (el.closest('[data-drop-kind="list-region"]') as HTMLElement | null) ??
    (el.closest('[data-drop-kind="board"]') as HTMLElement | null);
  if (regionEl) {
    let closestList: HTMLElement | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const target of listDropTargets) {
      if (!regionEl.contains(target)) continue;
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(x - centerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestList = target;
      }
    }
    if (closestList && resolveListDrop(closestList)) return;
  }

  setDragOver(null);
  activeDropElement = null;
}

function startGlobalDrag() {
  if (previousUserSelect === "") {
    previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
  }
  document.body.dataset.dragging = "true";
  setIsDragging(true);
}

function endGlobalDrag() {
  if (previousUserSelect !== "") {
    document.body.style.userSelect = previousUserSelect;
    previousUserSelect = "";
  }
  delete document.body.dataset.dragging;
  clearDragState();
  pendingDrag = null;
  activeDropElement = null;
  pointerId = null;
}

function cleanupListeners(
  move: (e: PointerEvent) => void,
  up: (e: PointerEvent) => void,
) {
  window.removeEventListener("pointermove", move);
  window.removeEventListener("pointerup", up);
  window.removeEventListener("pointercancel", up);
}

export function draggable(
  el: HTMLElement,
  accessor: Accessor<{ id: string; data?: any }>,
) {
  const getProps = accessor;

  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) return;
    if (document.body.dataset.resizing === "true") return;
    if (e.button !== 0 || pointerId !== null) return;
    e.preventDefault();
    const { id, data } = getProps();
    const offsetRoot = el.closest(
      '[data-drag-offset-root="true"]',
    ) as HTMLElement | null;
    const contentEl = el.querySelector(
      '[data-task-card="true"]',
    ) as HTMLElement | null;
    const rect = (offsetRoot ?? contentEl ?? el).getBoundingClientRect();
    let source: DragSource = null;
    const sourceKind = el.dataset.dragSource;
    if (sourceKind === "list") {
      source = {
        kind: "list",
        listId: el.dataset.dragList ?? "",
      };
    } else if (sourceKind === "calendar") {
      source = {
        kind: "calendar",
        date: el.dataset.dragDate ?? undefined,
      };
    }

    pendingDrag = {
      id,
      data,
      source,
      offset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      size: { width: rect.width, height: rect.height },
      startX: e.clientX,
      startY: e.clientY,
    };
    pointerId = e.pointerId;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (pointerId !== moveEvent.pointerId) return;
      if (!pendingDrag) return;

      const dx = moveEvent.clientX - pendingDrag.startX;
      const dy = moveEvent.clientY - pendingDrag.startY;
      const distance = Math.hypot(dx, dy);

      if (!activeDragId() && distance >= DRAG_THRESHOLD) {
        setActiveDragId(pendingDrag.id);
        setActiveDragData(pendingDrag.data ?? null);
        setDragSource(pendingDrag.source ?? null);
        setDragOffset(pendingDrag.offset);
        setDragSize(pendingDrag.size);
        setDragPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
        startGlobalDrag();
      }

      if (activeDragId()) {
        setDragPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
        resolveDropTarget(moveEvent.clientX, moveEvent.clientY);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (pointerId !== upEvent.pointerId) return;
      const dragId = activeDragId();
      const dragData = activeDragData();
      const source = dragSource();
      const fromRect = getDragOverlayRect();
      let handledDrop = false;
      if (dragId && activeDropElement) {
        const config = droppableRegistry.get(activeDropElement);
        if (config?.onDrop) {
          config.onDrop(dragId, { over: dragOver() });
          handledDrop = true;
        }
      }
      endGlobalDrag();
      cleanupListeners(handlePointerMove, handlePointerUp);
      if (!handledDrop && source?.kind === "list") {
        animateDropCancel(isTask(dragData) ? dragData : null, fromRect);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  el.addEventListener("pointerdown", handlePointerDown);

  onCleanup(() => {
    el.removeEventListener("pointerdown", handlePointerDown);
  });
}

export function droppable(
  el: HTMLElement,
  accessor: Accessor<{
    id: string;
    kind: DroppableKind;
    onDrop?: (itemId: string, info: DropInfo) => void;
  }>,
) {
  const getProps = accessor;

  createEffect(() => {
    const { id, kind, onDrop } = getProps();
    el.dataset.dropKind = kind;
    el.dataset.dropId = id;
    droppableRegistry.set(el, { id, kind, onDrop });
    if (kind === "list") {
      listDropTargets.add(el);
    } else {
      listDropTargets.delete(el);
    }
  });

  onCleanup(() => {
    delete el.dataset.dropKind;
    delete el.dataset.dropId;
    droppableRegistry.delete(el);
    listDropTargets.delete(el);
  });
}
