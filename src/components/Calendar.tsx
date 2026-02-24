import {
  type Component,
  type JSX,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { cva } from "class-variance-authority";
import {
  DEFAULT_CALENDAR_DRAFT_TITLE,
  useTaskStore,
  type Task,
} from "../store/taskStore";
import { draggable, droppable, type DropInfo } from "../directives/dnd";
import {
  activeDragData,
  activeDragId,
  dragOffset,
  dragOver,
  dragPosition,
  dragSource,
  isDragging,
  setDragOver,
} from "../store/dragStore";
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuState,
} from "./ContextMenu";
import {
  buildCalendarPreviewTasks,
  type CalendarPreviewTask,
  type CalendarSlot,
  type ResizePreview,
} from "../utils/dragPreview";
import { animateCalendarDrop } from "../utils/dropAnimation";
import {
  HOUR_HEIGHT,
  PIXELS_PER_MINUTE,
  DAY_MINUTES,
  clampMinutes,
  roundToStep,
  ROUND_MINUTES,
} from "../utils/calendarLayout";
import {
  formatLocalDate,
  getLocalDateId,
  getMinutesInDay,
  toDate,
} from "../utils/date";
import { useCalendarStore } from "../store/calendarStore";

// Keep directive imports referenced for TypeScript's unused symbol checks.
void draggable;
void droppable;

// Prevent TypeScript errors for custom directives
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      draggable: { id: string; data?: any };
      droppable: {
        id: string;
        kind: "list" | "calendar-day";
        onDrop?: (itemId: string, info: DropInfo) => void;
      };
    }
  }
}

const INITIAL_TIME_VIEWPORT_RATIO = 0.25;
const CREATE_SLOT_DRAG_THRESHOLD = 4;

// --- CalendarTask CVAs ---

type CalendarTaskCategory =
  | "none"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "greenblue"
  | "blue"
  | "purple";
type CalendarTaskVariant = "normal" | "ghost" | "resizing";

const calendarTaskClasses = cva("rounded-[16px] [--resize-edge:10px]", {
  variants: {
    variant: {
      normal:
        "border-2 border-(--outline) bg-(--calendar-task-bg) shadow-[var(--shadow-tile),var(--calendar-task-glow)] data-[selected=true]:shadow-[var(--shadow-tile),var(--calendar-task-glow),0_0_0_3px_color-mix(in_srgb,var(--accent)_70%,transparent)] data-[selected=true]:outline data-[selected=true]:outline-2 data-[selected=true]:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)] data-[selected=true]:[-outline-offset:1px]",
      ghost:
        "border-2 border-dashed border-(--outline) bg-(--calendar-task-ghost-bg) text-(--ink-muted) shadow-[var(--shadow-tile),var(--calendar-task-glow)]",
      resizing:
        "border-2 border-dashed border-(--outline) bg-(--calendar-task-resize-bg) text-(--ink-muted) shadow-[var(--shadow-tile),var(--calendar-task-glow)]",
    },
    past: {
      true: "opacity-60 saturate-75",
      false: "",
    },
    compact: {
      true: "[--resize-edge:4px] overflow-visible",
      false: "",
    },
    category: {
      none: "",
      red: "",
      orange: "",
      yellow: "",
      green: "",
      greenblue: "",
      blue: "",
      purple: "",
    },
  },
  compoundVariants: [
    // red
    {
      variant: "normal",
      category: "red",
      class:
        "border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-red)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "red",
      class:
        "bg-[color-mix(in_srgb,var(--category-red)_14%,transparent)] border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "red",
      class:
        "bg-[color-mix(in_srgb,var(--category-red)_18%,transparent)] border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))]",
    },
    // orange
    {
      variant: "normal",
      category: "orange",
      class:
        "border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-orange)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "orange",
      class:
        "bg-[color-mix(in_srgb,var(--category-orange)_14%,transparent)] border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "orange",
      class:
        "bg-[color-mix(in_srgb,var(--category-orange)_18%,transparent)] border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))]",
    },
    // yellow
    {
      variant: "normal",
      category: "yellow",
      class:
        "border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-yellow)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "yellow",
      class:
        "bg-[color-mix(in_srgb,var(--category-yellow)_14%,transparent)] border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "yellow",
      class:
        "bg-[color-mix(in_srgb,var(--category-yellow)_18%,transparent)] border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))]",
    },
    // green
    {
      variant: "normal",
      category: "green",
      class:
        "border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-green)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "green",
      class:
        "bg-[color-mix(in_srgb,var(--category-green)_14%,transparent)] border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "green",
      class:
        "bg-[color-mix(in_srgb,var(--category-green)_18%,transparent)] border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))]",
    },
    // greenblue
    {
      variant: "normal",
      category: "greenblue",
      class:
        "border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-greenblue)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "greenblue",
      class:
        "bg-[color-mix(in_srgb,var(--category-greenblue)_14%,transparent)] border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "greenblue",
      class:
        "bg-[color-mix(in_srgb,var(--category-greenblue)_18%,transparent)] border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))]",
    },
    // blue
    {
      variant: "normal",
      category: "blue",
      class:
        "border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-blue)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "blue",
      class:
        "bg-[color-mix(in_srgb,var(--category-blue)_14%,transparent)] border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "blue",
      class:
        "bg-[color-mix(in_srgb,var(--category-blue)_18%,transparent)] border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))]",
    },
    // purple
    {
      variant: "normal",
      category: "purple",
      class:
        "border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-purple)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "purple",
      class:
        "bg-[color-mix(in_srgb,var(--category-purple)_14%,transparent)] border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "purple",
      class:
        "bg-[color-mix(in_srgb,var(--category-purple)_18%,transparent)] border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))]",
    },
  ],
  defaultVariants: {
    variant: "normal",
    past: false,
    compact: false,
    category: "none",
  },
});

const calendarTaskTitleClasses = cva(
  "leading-[1.15] relative z-[2] pointer-events-none",
  {
    variants: {
      variant: {
        normal: "",
        ghost: "text-(--ink-muted)",
        resizing: "text-(--ink-muted)",
      },
      compact: {
        true: "absolute top-1/2 left-[10px] right-[10px] p-0 text-[0.65rem] leading-none -translate-y-1/2",
        false: "px-[0.45rem] py-[0.25rem]",
      },
      roomy: {
        true: "px-[0.55rem] py-[0.5rem]",
        false: "",
      },
      halfHourPlus: {
        true: "py-[7px]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "normal",
      compact: false,
      roomy: false,
      halfHourPlus: false,
    },
  },
);

// --- DayHeader ---

const dayHeaderClasses = cva(
  "px-[0.4rem] pt-[0.6rem] pb-[0.5rem] text-center border-b-2 border-dashed border-[var(--outline-soft)]",
  {
    variants: {
      today: {
        true: "bg-(--calendar-today-bg)",
        false: "bg-(--day-header-bg)",
      },
    },
    defaultVariants: {
      today: false,
    },
  },
);

const CalendarTask: Component<{
  task: CalendarPreviewTask;
  now: Date;
  isSelected?: boolean;
  isInlineEditing?: boolean;
  inlineTitle?: string;
  onStartInlineEdit?: (task: CalendarPreviewTask) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenDraftSlot?: (slotId: string) => void;
  onInlineTitleChange?: (title: string) => void;
  onCommitInlineEdit?: () => void;
  onCancelInlineEdit?: () => void;
  onSelectSlot?: (slotId: string | null, additive?: boolean) => void;
  onResizeStart?: (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => void;
  onResizeChange?: (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => void;
  onResizeEnd?: (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => void;
  isResizing?: (taskId: string) => boolean;
  onContextMenu?: (event: MouseEvent, task: CalendarPreviewTask) => void;
}> = (props) => {
  const isDraftSlot = createMemo(() => props.task.slotType === "draft");
  const taskVariant = createMemo<CalendarTaskVariant>(() =>
    props.isResizing?.(props.task.id) ? "resizing" : "normal",
  );
  const displayDuration = createMemo(
    () => props.task.__displayDuration ?? props.task.duration ?? 30,
  );
  const displayTime = createMemo(() => {
    const timeSource =
      props.task.__displayTime ?? (props.task.scheduledTime as Date | string);
    return new Date(timeSource);
  });
  const isCompact = createMemo(() => displayDuration() <= 15);
  const isRoomy = createMemo(() => displayDuration() > 15);
  const isHalfHourPlus = createMemo(() => displayDuration() >= 30);
  const style = createMemo(() => {
    const time = displayTime();
    // Cast to number for arithmetic
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const top = (hours * 60 + minutes) * PIXELS_PER_MINUTE;
    const height = displayDuration() * PIXELS_PER_MINUTE;

    let left = "4px";
    let right = "4px";
    if (props.task.overlapType === "left") {
      right = "calc(50% + 2px)";
    } else if (props.task.overlapType === "right") {
      left = "calc(50% + 2px)";
    }

    return {
      top: `${top}px`,
      height: `${height}px`,
      position: "absolute" as const,
      left,
      right,
    };
  });

  const isPast = createMemo(() => {
    const start = displayTime();
    const duration = displayDuration();
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    return end < props.now;
  });

  let cleanupResize: (() => void) | null = null;

  const handleResizePointerDown =
    (edge: "start" | "end") => (event: PointerEvent) => {
      if (event.button !== 0 || props.task.__ghost || props.isInlineEditing) {
        return;
      }
      const activeTask = props.task;
      const currentTarget = event.currentTarget as HTMLElement | null;
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const baseDuration = displayDuration();
      const startTime = displayTime();
      const baseStartMinutes =
        startTime.getHours() * 60 + startTime.getMinutes();
      let lastDuration = baseDuration;
      let lastStartMinutes = edge === "start" ? baseStartMinutes : undefined;

      props.onResizeStart?.(activeTask, baseDuration, lastStartMinutes);

      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      document.body.dataset.resizing = "true";

      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const delta = moveEvent.clientY - startY;
        const deltaMinutes = delta / PIXELS_PER_MINUTE;
        if (edge === "end") {
          const maxDuration = Math.max(1, DAY_MINUTES - baseStartMinutes);
          const minDuration = Math.min(ROUND_MINUTES, maxDuration);
          const nextDuration = Math.min(
            Math.max(minDuration, roundToStep(baseDuration + deltaMinutes)),
            maxDuration,
          );
          if (nextDuration === lastDuration) return;
          lastDuration = nextDuration;
          props.onResizeChange?.(activeTask, nextDuration);
          return;
        }

        const baseEndMinutes = baseStartMinutes + baseDuration;
        const minDuration = Math.min(ROUND_MINUTES, baseEndMinutes);
        const maxStart = Math.max(
          0,
          Math.min(baseEndMinutes - minDuration, DAY_MINUTES - minDuration),
        );
        let nextStart = roundToStep(baseStartMinutes + deltaMinutes);
        nextStart = Math.max(0, Math.min(nextStart, maxStart));
        const nextDuration = Math.max(minDuration, baseEndMinutes - nextStart);

        if (nextDuration === lastDuration && nextStart === lastStartMinutes) {
          return;
        }
        lastDuration = nextDuration;
        lastStartMinutes = nextStart;
        props.onResizeChange?.(activeTask, nextDuration, nextStart);
      };

      const finish = (finishEvent: PointerEvent) => {
        if (finishEvent.pointerId !== event.pointerId) return;
        cleanupResize?.();
        cleanupResize = null;
        props.onResizeEnd?.(activeTask, lastDuration, lastStartMinutes);
      };

      cleanupResize?.();
      cleanupResize = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.style.userSelect = previousUserSelect;
        delete document.body.dataset.resizing;
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      currentTarget?.setPointerCapture?.(event.pointerId);
    };

  onCleanup(() => {
    cleanupResize?.();
  });

  let pointerStart: { x: number; y: number; id: number } | null = null;

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || props.task.__ghost || props.isInlineEditing) {
      return;
    }
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (props.isInlineEditing) return;
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    pointerStart = null;
    if (distance > 4) return;
    if (isDragging()) return;
    if (!props.onSelectSlot) return;
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    props.onSelectSlot(props.task.id, additive);
  };

  const handlePointerCancel = () => {
    pointerStart = null;
  };

  let inlineTitleInputEl: HTMLInputElement | undefined;
  createEffect(() => {
    if (!props.isInlineEditing || !inlineTitleInputEl) return;
    const frame = requestAnimationFrame(() => {
      inlineTitleInputEl?.focus();
      inlineTitleInputEl?.select();
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  const handleInlineEditKeyDown: JSX.EventHandlerUnion<
    HTMLInputElement,
    KeyboardEvent
  > = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      props.onCommitInlineEdit?.();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      props.onCancelInlineEdit?.();
    }
  };

  return (
    <Show
      when={!props.task.__ghost}
      fallback={
        <div
          // @ts-ignore style object is valid
          style={style() as any}
          class={`${calendarTaskClasses({ variant: "ghost", compact: isCompact(), category: (props.task.category ?? "none") as CalendarTaskCategory })} absolute pointer-events-none z-10`}
          data-category={props.task.category ?? undefined}
        >
          <div
            class={`${calendarTaskTitleClasses({ variant: "ghost", compact: isCompact(), roomy: isRoomy(), halfHourPlus: isHalfHourPlus() })} text-xs font-medium truncate`}
          >
            {props.task.title}
          </div>
        </div>
      }
    >
      <div
        data-drag-offset-root="true"
        // @ts-ignore style object is valid
        style={style() as any}
        class={`${calendarTaskClasses({
          variant: taskVariant(),
          past: isPast(),
          compact: isCompact(),
          category: (props.task.category ?? "none") as CalendarTaskCategory,
        })} absolute z-10 transition-opacity`}
        data-category={props.task.category ?? undefined}
        data-selected={props.isSelected ? "true" : undefined}
        onContextMenu={(event) => {
          if (props.isInlineEditing || props.task.slotType === "external") return;
          event.preventDefault();
          event.stopPropagation();
          props.onContextMenu?.(event, props.task);
        }}
      >
        <Show
          when={!props.isInlineEditing && props.task.slotType !== "external"}
        >
          <div
            use:draggable={{ id: props.task.id, data: props.task }}
            data-drag-source="calendar"
            data-drag-date={
              getLocalDateId(
                props.task.__displayTime ?? props.task.scheduledTime,
              ) ?? ""
            }
            class="absolute top-(--resize-edge) bottom-(--resize-edge) left-0 right-0 cursor-grab active:cursor-grabbing z-1"
            aria-hidden="true"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onDblClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!isDraftSlot()) {
                props.onOpenTask?.(props.task.taskId);
                return;
              }
              props.onOpenDraftSlot?.(props.task.id);
            }}
          />
        </Show>
        <Show
          when={props.isInlineEditing}
          fallback={
            <div
              class={`${calendarTaskTitleClasses({
                variant: taskVariant(),
                compact: isCompact(),
                roomy: isRoomy() && !isCompact(),
                halfHourPlus: isHalfHourPlus(),
              })} text-xs font-medium truncate`}
            >
              {props.task.title}
            </div>
          }
        >
          <div class="relative z-3 px-[0.45rem] py-[0.35rem]">
            <input
              ref={inlineTitleInputEl}
              data-no-drag="true"
              value={props.inlineTitle ?? props.task.title}
              class="w-full rounded-[10px] border border-(--outline-soft) bg-(--surface-solid) px-[0.38rem] py-[0.2rem] text-xs font-medium text-(--ink) focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)]"
              onInput={(event) =>
                props.onInlineTitleChange?.(event.currentTarget.value)
              }
              onKeyDown={handleInlineEditKeyDown}
              onBlur={() => props.onCommitInlineEdit?.()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          </div>
        </Show>
        <Show
          when={!props.isInlineEditing && props.task.slotType !== "external"}
        >
          <div
            class="absolute left-0 right-0 top-0 h-(--resize-edge) flex items-center justify-center cursor-ns-resize opacity-0 bg-transparent touch-none z-2"
            onPointerDown={handleResizePointerDown("start")}
          />
          <div
            class="absolute left-0 right-0 bottom-0 h-(--resize-edge) flex items-center justify-center cursor-ns-resize opacity-0 bg-transparent touch-none z-2"
            onPointerDown={handleResizePointerDown("end")}
          />
        </Show>
      </div>
    </Show>
  );
};

const DayHeader: Component<{ date: Date; isToday: boolean }> = (props) => {
  const dayName = props.date.toLocaleDateString("en-US", { weekday: "short" });
  const dayNumber = props.date.getDate();
  const dateId = formatLocalDate(props.date);

  return (
    <div
      class="flex-1 min-w-[150px] border-r border-(--outline-soft)"
      data-day-id={dateId}
    >
      <div class={dayHeaderClasses({ today: props.isToday })}>
        <div class="inline-flex items-center gap-[0.3rem] px-[0.6rem] py-[0.2rem] rounded-full border border-(--outline) bg-(--surface-solid) text-[0.7rem] tracking-widest uppercase text-(--ink-muted)">
          {dayName}
        </div>
        <div
          class={`text-[1.25rem] font-semibold ${props.isToday ? "text-(--accent)" : ""}`}
        >
          {dayNumber}
        </div>
      </div>
    </div>
  );
};

const formatHour = (hour: number) => {
  const period = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
};

const TimeColumn: Component = () => {
  return (
    <div class="sticky left-0 z-25 bg-(--calendar-time-bg) backdrop-blur-[6px] w-16 shrink-0 border-r border-(--outline-soft)">
      <div
        class="relative bg-(--calendar-time-bg)"
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
    </div>
  );
};

const DayBody: Component<{
  date: Date;
  tasks: CalendarSlot[];
  now: Date;
  isToday: boolean;
  timeTopPx: number;
  resizePreview: ResizePreview | null;
  selectedSlotIds?: string[];
  editingDraftSlotId?: string | null;
  editingDraftTitle?: string;
  onSelectSlot?: (slotId: string | null, additive?: boolean) => void;
  onCreateDraftSlot: (
    date: Date,
    startMinutes: number,
    duration: number,
  ) => void;
  onStartDraftInlineEdit?: (task: CalendarPreviewTask) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenDraftSlot?: (slotId: string) => void;
  onDraftTitleChange?: (title: string) => void;
  onCommitDraftTitle?: () => void;
  onCancelDraftTitle?: () => void;
  onResizeStart: (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => void;
  onResizeChange: (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => void;
  onResizeEnd: (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => void;
  isResizing: (taskId: string) => boolean;
  onContextMenu?: (event: MouseEvent, task: CalendarPreviewTask) => void;
}> = (props) => {
  const [_, actions] = useTaskStore();
  const dateStr = formatLocalDate(props.date);

  const [previewTasks, setPreviewTasks] = createStore<CalendarPreviewTask[]>(
    [],
  );

  createEffect(() => {
    const next = buildCalendarPreviewTasks(
      props.tasks,
      activeDragId(),
      activeDragData() as Task | CalendarSlot | null,
      dragOver(),
      props.date,
      isDragging(),
      dragSource(),
      props.resizePreview,
    );

    // Compute overlaps between external and internal tasks
    for (const task of next) {
      task.overlapType = undefined;
      const startTime = toDate(task.__displayTime ?? task.scheduledTime);
      if (!startTime) continue;
      const startMinutes = getMinutesInDay(startTime);
      const endMinutes =
        startMinutes + (task.__displayDuration ?? task.duration);
      for (const other of next) {
        if (task.id === other.id) continue;
        const otherTime = toDate(other.__displayTime ?? other.scheduledTime);
        if (!otherTime) continue;
        const otherStart = getMinutesInDay(otherTime);
        const otherEnd =
          otherStart + (other.__displayDuration ?? other.duration);

        if (startMinutes < otherEnd && endMinutes > otherStart) {
          if (task.slotType === "external" && other.slotType !== "external") {
            task.overlapType = "right";
          } else if (
            task.slotType !== "external" &&
            other.slotType === "external"
          ) {
            task.overlapType = "left";
          }
        }
      }
    }

    setPreviewTasks(reconcile(next, { key: "id" }));
  });

  const handleDrop = (draggedId: string, info: DropInfo) => {
    const over = info.over;
    if (!over || over.kind !== "calendar" || over.date !== dateStr) return;

    const newDate = new Date(props.date);
    newDate.setHours(Math.floor(over.minutes / 60), over.minutes % 60, 0, 0);

    animateCalendarDrop(() => {
      if (dragSource()?.kind === "list") {
        actions.addScheduledSlot(draggedId, newDate);
      } else {
        const dragData = activeDragData() as CalendarSlot | Task | null;
        if (
          dragData &&
          typeof dragData === "object" &&
          "slotType" in dragData &&
          dragData.slotType === "draft"
        ) {
          actions.updateCalendarDraftSlotTime(draggedId, newDate);
        } else {
          actions.updateScheduledSlotTime(draggedId, newDate);
        }
      }
    });
  };

  const [draftCreatePreview, setDraftCreatePreview] = createSignal<{
    startMinutes: number;
    duration: number;
  } | null>(null);
  let cleanupDraftCreate: (() => void) | null = null;

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

  const updateDraftPreview = (
    anchorMinutes: number,
    currentMinutes: number,
  ) => {
    const startMinutes = Math.min(anchorMinutes, currentMinutes);
    const endMinutes = Math.max(anchorMinutes, currentMinutes);
    const duration = Math.max(ROUND_MINUTES, endMinutes - startMinutes);
    setDraftCreatePreview({
      startMinutes,
      duration,
    });
  };

  const handleBackgroundPointerDown: JSX.EventHandlerUnion<
    HTMLDivElement,
    PointerEvent
  > = (event) => {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;
    if (isDragging() || document.body.dataset.resizing === "true") return;

    const dayElement = event.currentTarget as HTMLDivElement;
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!additive) {
      props.onSelectSlot?.(null, false);
    }

    const anchorMinutes = getMinutesFromPointer(event, dayElement);
    const startY = event.clientY;
    let didDrag = false;
    const previousUserSelect = document.body.style.userSelect;
    let didRestoreUserSelect = false;
    const restoreUserSelect = () => {
      if (didRestoreUserSelect) return;
      document.body.style.userSelect = previousUserSelect;
      didRestoreUserSelect = true;
    };
    document.body.style.userSelect = "none";

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const distance = Math.abs(moveEvent.clientY - startY);
      if (distance < CREATE_SLOT_DRAG_THRESHOLD) return;
      didDrag = true;
      const currentMinutes = getMinutesFromPointer(moveEvent, dayElement);
      updateDraftPreview(anchorMinutes, currentMinutes);
    };

    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== event.pointerId) return;
      cleanupDraftCreate?.();
      cleanupDraftCreate = null;
      restoreUserSelect();

      const currentPreview = draftCreatePreview();
      setDraftCreatePreview(null);
      if (!didDrag || !currentPreview) return;
      props.onCreateDraftSlot(
        props.date,
        currentPreview.startMinutes,
        currentPreview.duration,
      );
    };

    cleanupDraftCreate?.();
    cleanupDraftCreate = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      restoreUserSelect();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    dayElement.setPointerCapture?.(event.pointerId);
  };

  onCleanup(() => {
    cleanupDraftCreate?.();
  });

  return (
    <div
      class="flex-1 min-w-[150px] border-r border-(--outline-soft)"
      data-day-id={dateStr}
    >
      <div
        use:droppable={{
          id: dateStr,
          kind: "calendar-day",
          onDrop: handleDrop,
        }}
        class="relative bg-(--calendar-grid-bg) overflow-hidden"
        style={{ height: "100%" }}
        onPointerDown={handleBackgroundPointerDown}
      >
        <Show when={props.isToday}>
          <div
            class="absolute left-0 right-0 border-t-2 border-(--brand) opacity-[0.95] z-12 pointer-events-none"
            style={{ top: `${props.timeTopPx}px` }}
          >
            <span class="absolute left-0 -top-[6px] w-3 h-3 rounded-full border-2 border-(--calendar-day-indicator-border,var(--outline)) bg-(--calendar-day-indicator-fill,var(--brand)) shadow-(--shadow-tile)" />
          </div>
        </Show>

        {/* Hour Grid Lines */}
        <For each={Array.from({ length: 24 })}>
          {(_, i) => (
            <div
              class="border-t border-dashed border-(--hour-line) text-(--ink-soft) absolute w-full text-[10px] pointer-events-none"
              aria-hidden="true"
              style={{ top: `${i() * HOUR_HEIGHT}px` }}
            />
          )}
        </For>

        <Show when={draftCreatePreview()}>
          {(preview) => (
            <div
              class="absolute left-[4px] right-[4px] z-9 rounded-[16px] border-2 border-dashed border-(--calendar-draft-slot-border) bg-(--calendar-draft-slot-ghost-bg) pointer-events-none"
              style={{
                top: `${preview().startMinutes * PIXELS_PER_MINUTE}px`,
                height: `${preview().duration * PIXELS_PER_MINUTE}px`,
              }}
            />
          )}
        </Show>

        <For each={previewTasks}>
          {(task) => (
            <CalendarTask
              task={task}
              now={props.now}
              isInlineEditing={
                task.slotType === "draft" &&
                props.editingDraftSlotId === task.id &&
                !task.__ghost
              }
              inlineTitle={props.editingDraftTitle}
              onStartInlineEdit={props.onStartDraftInlineEdit}
              onOpenTask={props.onOpenTask}
              onOpenDraftSlot={props.onOpenDraftSlot}
              onInlineTitleChange={props.onDraftTitleChange}
              onCommitInlineEdit={props.onCommitDraftTitle}
              onCancelInlineEdit={props.onCancelDraftTitle}
              isSelected={
                !task.__ghost && !!props.selectedSlotIds?.includes(task.id)
              }
              onSelectSlot={props.onSelectSlot}
              onResizeStart={props.onResizeStart}
              onResizeChange={props.onResizeChange}
              onResizeEnd={props.onResizeEnd}
              isResizing={props.isResizing}
              onContextMenu={props.onContextMenu}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export const Calendar: Component<{
  onOpenTask?: (taskId: string) => void;
  onOpenDraftSlot?: (slotId: string) => void;
}> = (props) => {
  const [state, actions] = useTaskStore();
  const [calendarState] = useCalendarStore();
  const [now, setNow] = createSignal(new Date());
  const [resizePreview, setResizePreview] = createSignal<ResizePreview | null>(
    null,
  );
  const isResizing = (slotId: string) => resizePreview()?.slotId === slotId;
  const [selectedSlotIds, setSelectedSlotIds] = createSignal<string[]>([]);
  const [editingDraftSlotId, setEditingDraftSlotId] = createSignal<
    string | null
  >(null);
  const [editingDraftTitle, setEditingDraftTitle] = createSignal("");
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>(null);
  let scrollEl: HTMLDivElement | undefined;
  let headerRowEl: HTMLDivElement | undefined;

  const tick = () => setNow(new Date());

  const interval = window.setInterval(tick, 60 * 1000);
  onCleanup(() => window.clearInterval(interval));

  const startOfWeek = createMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const date = new Date(d);
    date.setDate(diff);
    return date;
  });

  const weekDays = createMemo(() => {
    const start = startOfWeek();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  });

  const taskSlotExists = (tasks: Task[], slotId: string): boolean => {
    for (const task of tasks) {
      if (task.scheduledTimes.some((slot) => slot.id === slotId)) {
        return true;
      }
      if (task.subtasks.length > 0 && taskSlotExists(task.subtasks, slotId)) {
        return true;
      }
    }
    return false;
  };

  const getDraftSlotById = (slotId: string) => {
    return state.calendarDraftSlots.find((slot) => slot.id === slotId) ?? null;
  };

  const getSlotKind = (slotId: string): "task" | "draft" | null => {
    if (getDraftSlotById(slotId)) return "draft";
    if (taskSlotExists(state.tasks, slotId)) return "task";
    return null;
  };

  const collectTaskSlots = (
    tasks: Task[],
    dateStr: string,
    slots: CalendarSlot[],
  ) => {
    for (const task of tasks) {
      for (const slot of task.scheduledTimes) {
        if (getLocalDateId(slot.start) !== dateStr) continue;
        slots.push({
          id: slot.id,
          taskId: task.id,
          slotType: "task",
          title: task.title,
          category: task.category ?? null,
          scheduledTime: slot.start,
          duration: slot.duration ?? 30,
        });
      }
      if (task.subtasks.length > 0) {
        collectTaskSlots(task.subtasks, dateStr, slots);
      }
    }
  };

  const getSlotsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    const slots: CalendarSlot[] = [];
    collectTaskSlots(state.tasks, dateStr, slots);
    for (const slot of state.calendarDraftSlots) {
      if (getLocalDateId(slot.start) !== dateStr) continue;
      slots.push({
        id: slot.id,
        taskId: slot.id,
        slotType: "draft",
        title: slot.title || DEFAULT_CALENDAR_DRAFT_TITLE,
        category: slot.category ?? null,
        scheduledTime: slot.start,
        duration: slot.duration ?? 30,
      });
    }
    for (const event of calendarState.events) {
      if (getLocalDateId(event.start) !== dateStr) continue;
      slots.push({
        id: event.id,
        taskId: event.id,
        slotType: "external",
        title: event.title,
        category: null,
        scheduledTime: event.start,
        duration: event.duration,
      });
    }
    return slots;
  };

  const currentTimeTopPx = createMemo(() => {
    const minutes = clampMinutes(now().getHours() * 60 + now().getMinutes());
    return minutes * PIXELS_PER_MINUTE;
  });

  const scrollToFocus = () => {
    if (!scrollEl) return;
    const todayId = formatLocalDate(new Date());
    const todayEl = scrollEl.querySelector(
      `[data-day-id="${todayId}"]`,
    ) as HTMLElement | null;

    if (todayEl) {
      const timeColumnEl = scrollEl.querySelector(
        ".calendar-time-spacer",
      ) as HTMLElement | null;
      const pinnedTimeWidth = timeColumnEl?.offsetWidth ?? 0;
      const visibleDaysCenter =
        pinnedTimeWidth + (scrollEl.clientWidth - pinnedTimeWidth) / 2;
      const todayCenter = todayEl.offsetLeft + todayEl.offsetWidth / 2;
      const maxScrollLeft = Math.max(
        0,
        scrollEl.scrollWidth - scrollEl.clientWidth,
      );
      scrollEl.scrollLeft = Math.max(
        0,
        Math.min(todayCenter - visibleDaysCenter, maxScrollLeft),
      );
    }

    const headerHeight = headerRowEl?.offsetHeight ?? 0;
    const bodyViewportHeight = Math.max(
      0,
      scrollEl.clientHeight - headerHeight,
    );
    const targetTop = headerHeight + currentTimeTopPx();
    const desiredOffset =
      headerHeight + bodyViewportHeight * INITIAL_TIME_VIEWPORT_RATIO;
    const maxScrollTop = Math.max(
      0,
      scrollEl.scrollHeight - scrollEl.clientHeight,
    );
    scrollEl.scrollTop = Math.max(
      0,
      Math.min(targetTop - desiredOffset, maxScrollTop),
    );
  };

  onMount(() => {
    const frame = requestAnimationFrame(scrollToFocus);
    onCleanup(() => cancelAnimationFrame(frame));
  });

  createEffect(() => {
    if (!scrollEl) return;
    if (!isDragging() || dragSource()?.kind !== "calendar") return;

    const edge = 72;
    const maxSpeed = 8;
    let frame = 0;

    const updateCalendarDragOver = (position: { x: number; y: number }) => {
      if (!scrollEl) return;
      const dayEls = Array.from(
        scrollEl.querySelectorAll('[data-drop-kind="calendar-day"]'),
      ) as HTMLElement[];
      if (dayEls.length === 0) return;

      let closest: HTMLElement | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of dayEls) {
        const rect = candidate.getBoundingClientRect();
        let distance = 0;
        if (position.x < rect.left) distance = rect.left - position.x;
        else if (position.x > rect.right) distance = position.x - rect.right;
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = candidate;
        }
      }
      if (!closest) return;

      const date = closest.dataset.dropId;
      if (!date) return;
      const rect = closest.getBoundingClientRect();
      const yOffset = Math.max(0, Math.min(position.y - rect.top, rect.height));
      const offset = dragOffset()?.y ?? 0;
      const rawMinutes = (yOffset - offset) / PIXELS_PER_MINUTE;
      const minutes = clampMinutes(roundToStep(rawMinutes));
      setDragOver({ kind: "calendar", date, minutes });
    };

    const tick = () => {
      if (!scrollEl) return;
      const position = dragPosition();
      if (!position) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const rect = scrollEl.getBoundingClientRect();
      let dx = 0;
      let dy = 0;

      if (position.x < rect.left + edge) {
        const delta = rect.left + edge - position.x;
        const ratio = Math.min(1, delta / edge);
        dx = -Math.min(maxSpeed, ratio * ratio * maxSpeed);
      } else if (position.x > rect.right - edge) {
        const delta = position.x - (rect.right - edge);
        const ratio = Math.min(1, delta / edge);
        dx = Math.min(maxSpeed, ratio * ratio * maxSpeed);
      }

      if (position.y < rect.top + edge) {
        const delta = rect.top + edge - position.y;
        const ratio = Math.min(1, delta / edge);
        dy = -Math.min(maxSpeed, ratio * ratio * maxSpeed);
      } else if (position.y > rect.bottom - edge) {
        const delta = position.y - (rect.bottom - edge);
        const ratio = Math.min(1, delta / edge);
        dy = Math.min(maxSpeed, ratio * ratio * maxSpeed);
      }

      if (dx !== 0) {
        const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
        scrollEl.scrollLeft = Math.max(
          0,
          Math.min(scrollEl.scrollLeft + dx, maxScrollLeft),
        );
      }

      if (dy !== 0) {
        const maxScrollTop = scrollEl.scrollHeight - scrollEl.clientHeight;
        scrollEl.scrollTop = Math.max(
          0,
          Math.min(scrollEl.scrollTop + dy, maxScrollTop),
        );
      }

      if (dx !== 0 || dy !== 0) {
        updateCalendarDragOver(position);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(frame));
  });

  const handleResizeStart = (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => {
    if (isDragging()) return;
    const dateId = getLocalDateId(task.__displayTime ?? task.scheduledTime);
    if (!dateId) return;
    setResizePreview({
      slotId: task.id,
      date: dateId,
      duration,
      startMinutes,
    });
  };

  const handleResizeChange = (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => {
    setResizePreview((current) => {
      if (!current || current.slotId !== task.id) return current;
      return { ...current, duration, startMinutes };
    });
  };

  const handleResizeEnd = (
    task: CalendarPreviewTask,
    duration: number,
    startMinutes?: number,
  ) => {
    setResizePreview(null);
    const originalDuration = task.duration ?? 30;
    const originalStartTime = new Date(
      task.__displayTime ?? (task.scheduledTime as Date | string),
    );
    const originalStartMinutes =
      originalStartTime.getHours() * 60 + originalStartTime.getMinutes();
    const startChanged =
      startMinutes != null && startMinutes !== originalStartMinutes;
    if (duration === originalDuration && !startChanged) return;
    if (task.slotType === "draft") {
      actions.updateCalendarDraftSlotDuration(task.id, duration, startMinutes);
      return;
    }
    actions.updateScheduledSlotDuration(task.id, duration, startMinutes);
  };

  const slotExists = (slotId: string) => {
    return getSlotKind(slotId) !== null;
  };

  createEffect(() => {
    const current = selectedSlotIds();
    if (current.length === 0) return;
    const next = current.filter((slotId) => slotExists(slotId));
    if (next.length !== current.length) {
      setSelectedSlotIds(next);
    }
  });

  const clearDraftInlineEditor = () => {
    setEditingDraftSlotId(null);
    setEditingDraftTitle("");
  };

  createEffect(() => {
    const activeDraftSlotId = editingDraftSlotId();
    if (!activeDraftSlotId) return;
    const slot = getDraftSlotById(activeDraftSlotId);
    if (slot) return;
    clearDraftInlineEditor();
  });

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const slots = selectedSlotIds();
      if (slots.length === 0) return;
      if (isDragging() || resizePreview()) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        const isInput =
          tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable;
        if (isInput) return;
      }
      event.preventDefault();
      slots.forEach((slotId) => {
        if (getSlotKind(slotId) === "draft") {
          actions.removeCalendarDraftSlot(slotId);
          return;
        }
        actions.removeScheduledSlot(slotId);
      });
      const activeDraftSlotId = editingDraftSlotId();
      if (activeDraftSlotId && slots.includes(activeDraftSlotId)) {
        clearDraftInlineEditor();
      }
      setSelectedSlotIds([]);
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const commitDraftTitle = () => {
    const slotId = editingDraftSlotId();
    if (!slotId) return;
    actions.updateCalendarDraftSlotTitle(slotId, editingDraftTitle());
    clearDraftInlineEditor();
  };

  const cancelDraftTitle = () => {
    clearDraftInlineEditor();
  };

  const startDraftInlineEdit = (task: CalendarPreviewTask) => {
    if (task.__ghost || task.slotType !== "draft") return;
    setSelectedSlotIds([task.id]);
    setEditingDraftSlotId(task.id);
    setEditingDraftTitle(task.title || DEFAULT_CALENDAR_DRAFT_TITLE);
  };

  const handleCreateDraftSlot = (
    date: Date,
    startMinutes: number,
    duration: number,
  ) => {
    commitDraftTitle();
    const start = new Date(date);
    start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const slotId = actions.addCalendarDraftSlot(
      start,
      duration,
      DEFAULT_CALENDAR_DRAFT_TITLE,
    );
    setSelectedSlotIds([slotId]);
    setEditingDraftSlotId(slotId);
    setEditingDraftTitle(DEFAULT_CALENDAR_DRAFT_TITLE);
  };

  const handleSelectSlot = (slotId: string | null, additive = false) => {
    const activeDraftSlotId = editingDraftSlotId();
    if (activeDraftSlotId && activeDraftSlotId !== slotId) {
      commitDraftTitle();
    }
    if (!slotId) {
      if (!additive) setSelectedSlotIds([]);
      return;
    }
    const current = selectedSlotIds();
    if (!additive) {
      setSelectedSlotIds([slotId]);
      return;
    }
    if (current.includes(slotId)) {
      setSelectedSlotIds(current.filter((id) => id !== slotId));
      return;
    }
    setSelectedSlotIds([...current, slotId]);
  };

  const handleCalendarContextMenu = (
    event: MouseEvent,
    task: CalendarPreviewTask,
  ) => {
    handleSelectSlot(task.id);

    const items: ContextMenuItem[] = [];

    if (task.slotType === "draft") {
      items.push({
        label: "Add to inbox",
        onClick: () => actions.convertDraftSlotToTask(task.id),
      });
      items.push({
        label: "Edit",
        onClick: () => props.onOpenDraftSlot?.(task.id),
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: () => actions.removeCalendarDraftSlot(task.id),
      });
    } else if (task.slotType === "task") {
      items.push({
        label: "Edit",
        onClick: () => props.onOpenTask?.(task.taskId),
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: () => actions.removeScheduledSlot(task.id),
      });
    }

    if (items.length > 0) {
      setContextMenu({ x: event.clientX, y: event.clientY, items });
    }
  };

  return (
    <div
      class="relative h-full overflow-hidden flex flex-col transition-colors rounded-(--radius-card) border-2 border-(--panel-outline) bg-(--surface-2) shadow-[var(--shadow-pop),var(--panel-glow)] [backdrop-filter:var(--panel-backdrop-filter,none)] before:content-[''] before:absolute before:inset-0 before:bg-(--panel-highlight) before:rounded-[inherit] before:pointer-events-none"
      data-drop-kind="calendar-zone"
    >
      <div class="relative z-1 flex items-center justify-between px-4 pt-4">
        <h2 class="font-display text-[1.2rem] font-semibold tracking-[0.02em]">
          Calendar
        </h2>
      </div>

      <div
        class="relative z-1 flex-1 min-h-0 overflow-auto pr-4 pb-4 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink-muted)_58%,transparent)_transparent] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--ink-muted)_58%,transparent)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--ink-muted)_74%,transparent)]"
        ref={scrollEl}
      >
        <div class="min-w-[980px]">
          <div
            class="sticky top-0 z-20 bg-(--calendar-header-bg) backdrop-blur-[6px] border-b-2 border-(--calendar-header-border) flex"
            ref={headerRowEl}
          >
            <div class="calendar-time-spacer sticky left-0 z-30 bg-(--calendar-time-bg) backdrop-blur-[6px] border-r border-(--outline-soft) w-16 shrink-0" />
            <For each={weekDays()}>
              {(date) => (
                <DayHeader
                  date={date}
                  isToday={now().toDateString() === date.toDateString()}
                />
              )}
            </For>
          </div>

          <div
            class="relative flex"
            style={{ height: `${24 * HOUR_HEIGHT}px` }}
          >
            <div
              class="absolute left-0 right-0 border-t-2 border-dashed border-(--current-week-line) opacity-80 z-6 pointer-events-none shadow-[0_1px_0_var(--current-week-line-shadow)]"
              style={{ top: `${currentTimeTopPx()}px` }}
            />
            <TimeColumn />
            <For each={weekDays()}>
              {(date) => (
                <DayBody
                  date={date}
                  tasks={getSlotsForDate(date)}
                  now={now()}
                  isToday={now().toDateString() === date.toDateString()}
                  timeTopPx={currentTimeTopPx()}
                  resizePreview={resizePreview()}
                  selectedSlotIds={selectedSlotIds()}
                  editingDraftSlotId={editingDraftSlotId()}
                  editingDraftTitle={editingDraftTitle()}
                  onSelectSlot={handleSelectSlot}
                  onCreateDraftSlot={handleCreateDraftSlot}
                  onStartDraftInlineEdit={startDraftInlineEdit}
                  onOpenTask={props.onOpenTask}
                  onOpenDraftSlot={props.onOpenDraftSlot}
                  onDraftTitleChange={setEditingDraftTitle}
                  onCommitDraftTitle={commitDraftTitle}
                  onCancelDraftTitle={cancelDraftTitle}
                  onResizeStart={handleResizeStart}
                  onResizeChange={handleResizeChange}
                  onResizeEnd={handleResizeEnd}
                  isResizing={isResizing}
                  onContextMenu={handleCalendarContextMenu}
                />
              )}
            </For>
          </div>
        </div>
      </div>
      <ContextMenu
        state={contextMenu()}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};
