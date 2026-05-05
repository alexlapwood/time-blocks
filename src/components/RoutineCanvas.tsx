import { type Component, For, createMemo, createSignal, onCleanup } from "solid-js";
import {
  clampMinutes,
  DAY_MINUTES,
  HOUR_HEIGHT,
  PIXELS_PER_MINUTE,
  ROUND_MINUTES,
  roundToStep,
} from "../utils/calendarLayout";
import {
  DEFAULT_CALENDAR_DRAFT_TITLE,
  useTaskStore,
  type RoutineItem,
  type Weekday,
} from "../store/taskStore";
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuState,
} from "./ContextMenu";

const CREATE_SLOT_DRAG_THRESHOLD = 4;
const MOVE_DRAG_THRESHOLD = 4;

type DragPreview = {
  id: string;
  weekday: Weekday;
  startMinutes: number;
};

type ResizePreview = {
  id: string;
  startMinutes: number;
  duration: number;
};

const WEEKDAY_LABELS = [
  { label: "Mon", weekday: 1 },
  { label: "Tue", weekday: 2 },
  { label: "Wed", weekday: 3 },
  { label: "Thu", weekday: 4 },
  { label: "Fri", weekday: 5 },
  { label: "Sat", weekday: 6 },
  { label: "Sun", weekday: 0 },
] as const;

const formatHour = (hour: number) => {
  const period = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
};

type RoutineCanvasProps = {
  onOpenItem?: (id: string) => void;
};

export const RoutineCanvas: Component<RoutineCanvasProps> = (_props) => {
  const [state, actions] = useTaskStore();
  const [createPreview, setCreatePreview] = createSignal<{
    weekday: Weekday;
    startMinutes: number;
    duration: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = createSignal<DragPreview | null>(null);
  const [resizePreview, setResizePreview] = createSignal<ResizePreview | null>(
    null,
  );
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>(null);
  let cleanupCreate: (() => void) | null = null;
  let cleanupItemPointer: (() => void) | null = null;
  onCleanup(() => {
    cleanupCreate?.();
    cleanupItemPointer?.();
  });

  const itemDisplayPosition = (
    item: RoutineItem,
  ): { startMinutes: number; duration: number; weekday: Weekday } => {
    const drag = dragPreview();
    if (drag && drag.id === item.id) {
      return {
        startMinutes: drag.startMinutes,
        duration: item.duration,
        weekday: drag.weekday,
      };
    }
    const resize = resizePreview();
    if (resize && resize.id === item.id) {
      return {
        startMinutes: resize.startMinutes,
        duration: resize.duration,
        weekday: item.homeDay,
      };
    }
    return {
      startMinutes: item.startMinutes,
      duration: item.duration,
      weekday: item.homeDay,
    };
  };

  const itemsByDay = createMemo(() => {
    const grouped = new Map<number, RoutineItem[]>();
    for (const day of WEEKDAY_LABELS) {
      grouped.set(day.weekday, []);
    }
    for (const item of state.weeklyTemplate) {
      const displayWeekday = itemDisplayPosition(item).weekday;
      grouped.get(displayWeekday)?.push(item);
    }
    return grouped;
  });

  const getMinutesFromPointer = (
    event: PointerEvent,
    dayElement: HTMLElement,
  ) => {
    const rect = dayElement.getBoundingClientRect();
    const yOffset = Math.max(
      0,
      Math.min(event.clientY - rect.top, rect.height),
    );
    return clampMinutes(roundToStep(yOffset / PIXELS_PER_MINUTE));
  };

  const handleColumnPointerDown = (
    event: PointerEvent,
    weekday: Weekday,
  ) => {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;

    const dayElement = event.currentTarget as HTMLDivElement;
    const anchorMinutes = getMinutesFromPointer(event, dayElement);
    const startY = event.clientY;
    let didDrag = false;
    let currentMinutes = anchorMinutes;

    const updatePreview = () => {
      const startMinutes = Math.min(anchorMinutes, currentMinutes);
      const endMinutes = Math.max(anchorMinutes, currentMinutes);
      const duration = Math.max(ROUND_MINUTES, endMinutes - startMinutes);
      setCreatePreview({ weekday, startMinutes, duration });
    };

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const distance = Math.abs(moveEvent.clientY - startY);
      if (distance < CREATE_SLOT_DRAG_THRESHOLD) return;
      didDrag = true;
      currentMinutes = getMinutesFromPointer(moveEvent, dayElement);
      updatePreview();
    };

    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== event.pointerId) return;
      cleanupCreate?.();
      cleanupCreate = null;
      const preview = createPreview();
      setCreatePreview(null);
      if (!didDrag || !preview) return;
      actions.addRoutineItem({
        title: DEFAULT_CALENDAR_DRAFT_TITLE,
        duration: preview.duration,
        homeDay: weekday,
        startMinutes: preview.startMinutes,
        repeatDays: [],
      });
    };

    cleanupCreate?.();
    cleanupCreate = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    dayElement.setPointerCapture?.(event.pointerId);
  };

  const handleItemDragPointerDown = (
    event: PointerEvent,
    item: RoutineItem,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    let lastStart = item.startMinutes;
    let lastWeekday: Weekday = item.homeDay;
    let didMove = false;

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (
        !didMove &&
        Math.hypot(dx, dy) < MOVE_DRAG_THRESHOLD
      ) {
        return;
      }
      didMove = true;
      const deltaMinutes = roundToStep(dy / PIXELS_PER_MINUTE);
      const maxStart = Math.max(0, DAY_MINUTES - item.duration);
      lastStart = Math.max(
        0,
        Math.min(maxStart, item.startMinutes + deltaMinutes),
      );

      const target =
        typeof document.elementFromPoint === "function"
          ? (document.elementFromPoint(
              moveEvent.clientX,
              moveEvent.clientY,
            ) as HTMLElement | null)
          : null;
      const columnEl = target?.closest("[data-routine-day]") as HTMLElement | null;
      if (columnEl) {
        const dayAttr = columnEl.getAttribute("data-routine-day");
        if (dayAttr !== null) {
          const parsed = Number.parseInt(dayAttr, 10);
          if (
            Number.isInteger(parsed) &&
            parsed >= 0 &&
            parsed <= 6
          ) {
            lastWeekday = parsed as Weekday;
          }
        }
      }

      setDragPreview({
        id: item.id,
        weekday: lastWeekday,
        startMinutes: lastStart,
      });
    };

    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== event.pointerId) return;
      cleanupItemPointer?.();
      cleanupItemPointer = null;
      setDragPreview(null);
      if (!didMove) return;
      actions.updateRoutineItem(item.id, {
        startMinutes: lastStart,
        homeDay: lastWeekday,
      });
    };

    cleanupItemPointer?.();
    cleanupItemPointer = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const handleItemResizePointerDown = (
    event: PointerEvent,
    item: RoutineItem,
    edge: "start" | "end",
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    let lastDuration = item.duration;
    let lastStart = item.startMinutes;

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const delta = roundToStep(
        (moveEvent.clientY - startY) / PIXELS_PER_MINUTE,
      );
      if (edge === "end") {
        const maxDuration = Math.max(ROUND_MINUTES, DAY_MINUTES - item.startMinutes);
        lastDuration = Math.max(
          ROUND_MINUTES,
          Math.min(maxDuration, item.duration + delta),
        );
      } else {
        const baseEnd = item.startMinutes + item.duration;
        const minDuration = Math.min(ROUND_MINUTES, baseEnd);
        const maxStart = Math.max(
          0,
          Math.min(baseEnd - minDuration, DAY_MINUTES - minDuration),
        );
        let nextStart = clampMinutes(item.startMinutes + delta);
        nextStart = Math.max(0, Math.min(nextStart, maxStart));
        lastStart = nextStart;
        lastDuration = Math.max(minDuration, baseEnd - nextStart);
      }
      setResizePreview({
        id: item.id,
        startMinutes: lastStart,
        duration: lastDuration,
      });
    };

    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== event.pointerId) return;
      cleanupItemPointer?.();
      cleanupItemPointer = null;
      setResizePreview(null);
      if (
        lastDuration === item.duration &&
        lastStart === item.startMinutes
      ) {
        return;
      }
      actions.updateRoutineItem(item.id, {
        duration: lastDuration,
        startMinutes: lastStart,
      });
    };

    cleanupItemPointer?.();
    cleanupItemPointer = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  return (
    <div class="relative flex h-full flex-col overflow-hidden">
      <div class="flex border-b-2 border-(--calendar-header-border) bg-(--calendar-header-bg)">
        <div class="w-16 shrink-0 border-r border-(--outline-soft)" />
        <For each={WEEKDAY_LABELS}>
          {(day) => (
            <div
              data-routine-day-header={day.weekday}
              class="flex-1 min-w-[120px] border-r border-(--outline-soft) px-[0.4rem] py-[0.6rem] text-center"
            >
              <div class="inline-flex items-center gap-[0.3rem] px-[0.6rem] py-[0.2rem] rounded-full border border-(--outline) bg-(--surface-solid) text-[0.7rem] tracking-widest uppercase text-(--ink-muted)">
                {day.label}
              </div>
            </div>
          )}
        </For>
      </div>
      <div class="relative flex flex-1 overflow-auto">
        <div
          class="sticky left-0 z-10 w-16 shrink-0 border-r border-(--outline-soft) bg-(--calendar-time-bg)"
          style={{ height: `${24 * HOUR_HEIGHT}px` }}
        >
          <For each={Array.from({ length: 24 })}>
            {(_, i) => (
              <div
                class="border-t border-dashed border-(--hour-line) text-(--ink-soft) absolute w-full text-[10px] text-right pr-2"
                style={{ top: `${i() * HOUR_HEIGHT}px` }}
              >
                {formatHour(i())}
              </div>
            )}
          </For>
        </div>
        <div class="relative flex flex-1" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          <For each={WEEKDAY_LABELS}>
            {(day) => {
              const preview = () => {
                const current = createPreview();
                if (!current || current.weekday !== day.weekday) return null;
                return current;
              };
              return (
                <div
                  data-routine-day={day.weekday}
                  class="relative flex-1 min-w-[120px] border-r border-(--outline-soft) bg-(--calendar-grid-bg)"
                  onPointerDown={(event) =>
                    handleColumnPointerDown(event, day.weekday as Weekday)
                  }
                >
                  <For each={Array.from({ length: 24 })}>
                    {(_, i) => (
                      <div
                        class="border-t border-dashed border-(--hour-line) absolute w-full pointer-events-none"
                        style={{ top: `${i() * HOUR_HEIGHT}px` }}
                      />
                    )}
                  </For>
                  {preview() && (
                    <div
                      class="absolute left-[4px] right-[4px] rounded-[16px] border-2 border-dashed border-(--calendar-draft-slot-border,var(--outline)) bg-(--calendar-draft-slot-ghost-bg,transparent) pointer-events-none z-9"
                      style={{
                        top: `${preview()!.startMinutes * PIXELS_PER_MINUTE}px`,
                        height: `${preview()!.duration * PIXELS_PER_MINUTE}px`,
                      }}
                    />
                  )}
                  <For each={itemsByDay().get(day.weekday) ?? []}>
                    {(item) => {
                      const display = () => itemDisplayPosition(item);
                      return (
                        <div
                          data-routine-item-id={item.id}
                          class="absolute left-[4px] right-[4px] rounded-[16px] border-2 border-(--outline) bg-(--calendar-task-bg) shadow-(--shadow-tile)"
                          style={{
                            top: `${display().startMinutes * PIXELS_PER_MINUTE}px`,
                            height: `${display().duration * PIXELS_PER_MINUTE}px`,
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const items: ContextMenuItem[] = [
                              {
                                label: "Edit",
                                onClick: () => _props.onOpenItem?.(item.id),
                              },
                              {
                                label: "Delete",
                                danger: true,
                                onClick: () =>
                                  actions.deleteRoutineItem(item.id),
                              },
                            ];
                            setContextMenu({
                              x: event.clientX,
                              y: event.clientY,
                              items,
                            });
                          }}
                        >
                          <div
                            data-routine-drag-handle
                            class="absolute inset-x-0 top-[10px] bottom-[10px] cursor-grab active:cursor-grabbing px-[0.45rem] py-1"
                            onPointerDown={(event) =>
                              handleItemDragPointerDown(event, item)
                            }
                            onDblClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              _props.onOpenItem?.(item.id);
                            }}
                          >
                            <div class="text-xs font-medium truncate pointer-events-none">
                              {item.title}
                            </div>
                          </div>
                          <div
                            data-routine-resize="start"
                            class="absolute left-0 right-0 top-0 h-[10px] cursor-ns-resize"
                            onPointerDown={(event) =>
                              handleItemResizePointerDown(event, item, "start")
                            }
                          />
                          <div
                            data-routine-resize="end"
                            class="absolute left-0 right-0 bottom-0 h-[10px] cursor-ns-resize"
                            onPointerDown={(event) =>
                              handleItemResizePointerDown(event, item, "end")
                            }
                          />
                        </div>
                      );
                    }}
                  </For>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <ContextMenu state={contextMenu()} onClose={() => setContextMenu(null)} />
    </div>
  );
};
