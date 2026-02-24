import { type Component, Show } from "solid-js";
import { cva } from "class-variance-authority";
import {
  type CategoryId,
  type Task,
  type PriorityLevel,
} from "../store/taskStore";
import { isDragging } from "../store/dragStore";

type EisenhowerQuadrant = "do" | "schedule" | "delegate" | "eliminate";

const EISENHOWER_LABELS: Record<EisenhowerQuadrant, string> = {
  do: "Do First",
  schedule: "Schedule",
  delegate: "Delegate",
  eliminate: "Eliminate",
};

const isHighPriority = (level: PriorityLevel | undefined): boolean =>
  level === "high";

type DueUrgency = "normal" | "soon" | "urgent";

const getDueUrgency = (dueDate: string | null | undefined): DueUrgency => {
  if (!dueDate) return "normal";
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "normal";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    todayStart.getDate() + 2,
  );
  if (due < tomorrowEnd && due >= todayStart) {
    const tomorrowStart = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() + 1,
    );
    return due < tomorrowStart ? "urgent" : "soon";
  }
  if (due < todayStart) return "urgent";
  return "normal";
};

const getEisenhowerQuadrant = (
  importance: PriorityLevel | undefined,
  urgency: PriorityLevel | undefined,
): EisenhowerQuadrant | null => {
  const imp = importance ?? "none";
  const urg = urgency ?? "none";
  if (imp === "none" && urg === "none") return null;
  const important = isHighPriority(importance);
  const urgent = isHighPriority(urgency);
  if (important && urgent) return "do";
  if (important) return "schedule";
  if (urgent) return "delegate";
  return "eliminate";
};

interface TaskCardProps {
  task: Task;
  variant?: "normal" | "overlay" | "ghost";
  dropSettling?: boolean;
  onOpen?: (taskId: string) => void;
  onToggleCollapse?: (taskId: string) => void;
  showDueDate?: boolean;
}

const resolveCategoryVariant = (category: CategoryId | null | undefined) =>
  category ?? "none";

const taskCardClasses = cva(
  "min-w-0 rounded-[14px] border-2 px-[14px] py-[11px] text-[var(--ink)] shadow-[var(--shadow-tile),var(--card-glow)] [transform:translate3d(0,0,0)] transition-[transform,box-shadow] [transition-duration:var(--speed-base)]",
  {
    variants: {
      category: {
        none: "border-(--outline) bg-(--surface-solid)",
        red: "border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-red)_18%,var(--surface-solid))]",
        orange:
          "border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-orange)_18%,var(--surface-solid))]",
        yellow:
          "border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-yellow)_18%,var(--surface-solid))]",
        green:
          "border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-green)_18%,var(--surface-solid))]",
        greenblue:
          "border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-greenblue)_18%,var(--surface-solid))]",
        blue: "border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-blue)_18%,var(--surface-solid))]",
        purple:
          "border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-purple)_18%,var(--surface-solid))]",
      },
      variant: {
        normal:
          "cursor-grab hover:[transform:translateY(-2px)_rotate(-1deg)] hover:shadow-[var(--shadow-soft),var(--card-glow)] [[data-dragging='true']_&]:hover:[transform:translate3d(0,0,0)] [[data-dragging='true']_&]:hover:shadow-[var(--shadow-tile),var(--card-glow)]",
        overlay:
          "cursor-grabbing [transform:rotate(-2deg)_scale(1.04)] shadow-(--shadow-pop)",
        ghost: "border-dashed bg-(--task-ghost-bg) text-ink-soft opacity-80",
      },
      settling: {
        true: "animate-[dropSettle_var(--speed-base)_cubic-bezier(0.2,0.7,0.2,1)_forwards]",
        false: "",
      },
    },
    defaultVariants: {
      category: "none",
      variant: "normal",
      settling: false,
    },
  },
);

const taskTitleClasses = cva("font-bold [overflow-wrap:anywhere] break-words", {
  variants: {
    ghost: {
      true: "text-ink-soft",
      false: "text-[var(--ink)]",
    },
  },
  defaultVariants: {
    ghost: false,
  },
});

const taskMetaClasses = cva(
  "mt-[0.35rem] flex flex-wrap items-center gap-[0.4rem]",
);

const taskIndicatorClasses = cva(
  "inline-flex h-[0.95rem] w-[0.95rem] flex-none self-center items-center justify-center text-[color-mix(in_srgb,var(--brand)_56%,var(--ink-muted))]",
);

const taskIndicatorIconClasses = cva("h-full w-full");

const baseBadgeClasses =
  "rounded-full border border-(--outline) bg-(--surface-solid) px-[0.45rem] py-[0.15rem] text-[0.7rem] font-semibold";

const badgeClasses = cva(baseBadgeClasses, {
  variants: {
    kind: {
      subtasks: "bg-(--badge-subtasks-bg)",
      time: "bg-(--badge-time-bg)",
    },
  },
});

const dueBadgeClasses = cva(baseBadgeClasses, {
  variants: {
    urgency: {
      normal:
        "bg-[color-mix(in_srgb,var(--brand)_12%,var(--surface-solid))] border-[color-mix(in_srgb,var(--brand)_28%,var(--outline))] text-[var(--ink)]",
      soon: "bg-[color-mix(in_srgb,var(--category-orange)_20%,var(--surface-solid))] border-[color-mix(in_srgb,var(--category-orange)_52%,var(--outline))] text-[var(--ink)]",
      urgent:
        "bg-[color-mix(in_srgb,var(--category-red)_20%,var(--surface-solid))] border-[color-mix(in_srgb,var(--category-red)_54%,var(--outline))] text-[var(--ink)]",
    },
  },
  defaultVariants: {
    urgency: "normal",
  },
});

const eisenhowerBadgeClasses = cva(
  `${baseBadgeClasses} inline-flex items-center gap-[6px] rounded-[12px] px-[9px] py-[3px] text-[var(--ink)] [--eisenhower-accent:color-mix(in_srgb,var(--ink-muted)_74%,var(--ink))]`,
  {
    variants: {
      quadrant: {
        do: "[--eisenhower-accent:color-mix(in_srgb,var(--category-red)_78%,var(--ink))] border-[color-mix(in_srgb,var(--category-red)_40%,var(--outline))] bg-[color-mix(in_srgb,var(--category-red)_14%,var(--surface-solid))]",
        schedule:
          "[--eisenhower-accent:color-mix(in_srgb,var(--category-blue)_70%,var(--ink))] border-[color-mix(in_srgb,var(--category-blue)_40%,var(--outline))] bg-[color-mix(in_srgb,var(--category-blue)_14%,var(--surface-solid))]",
        delegate:
          "[--eisenhower-accent:color-mix(in_srgb,var(--category-orange)_76%,var(--ink))] border-[color-mix(in_srgb,var(--category-orange)_40%,var(--outline))] bg-[color-mix(in_srgb,var(--category-orange)_14%,var(--surface-solid))]",
        eliminate:
          "[--eisenhower-accent:color-mix(in_srgb,var(--ink-muted)_82%,var(--ink))] border-[color-mix(in_srgb,var(--ink-soft)_42%,var(--outline))] bg-[color-mix(in_srgb,var(--ink-soft)_10%,var(--surface-solid))]",
      },
    },
  },
);

const eisenhowerGridClasses = cva("grid grid-cols-2 grid-rows-2 gap-[2px]");

const eisenhowerCellClasses = cva(
  "h-[4px] w-[4px] rounded-[1px] bg-[color-mix(in_srgb,var(--eisenhower-accent)_30%,#fff)]",
  {
    variants: {
      active: {
        true: "bg-[var(--eisenhower-accent)]",
        false: "",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

const badgeLabelClasses = cva(
  "text-[13px] font-bold leading-[1.05] text-[var(--ink)]",
);

export const TaskCard: Component<TaskCardProps> = (props) => {
  const variant = () => props.variant ?? "normal";
  const isGhostVariant = () => variant() === "ghost";
  const isPassiveVariant = () => variant() !== "normal";
  const category = () => resolveCategoryVariant(props.task.category);
  const sumDurations = (task: Task): number => {
    let total = task.scheduledTimes.reduce(
      (sum, slot) => sum + slot.duration,
      0,
    );
    for (const sub of task.subtasks) {
      total += sumDurations(sub);
    }
    return total;
  };
  const totalDuration = () => sumDurations(props.task);
  const totalDurationLabel = () => {
    const total = totalDuration();
    if (total <= 0) return "";
    if (total < 60) return `${total}m`;
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };
  const showDueDate = () => props.showDueDate ?? true;
  const hasDueDate = () => showDueDate() && Boolean(formattedDueDate());
  const hasSubtasks = () => props.task.subtasks.length > 0;
  const hasDuration = () => Boolean(totalDurationLabel());
  const hasDescription = () => Boolean(props.task.description?.trim());
  const quadrant = () =>
    getEisenhowerQuadrant(props.task.importance, props.task.urgency);
  const hasEisenhower = () => quadrant() !== null;
  const dueUrgency = () => getDueUrgency(props.task.dueDate);
  const hasMeta = () =>
    hasDueDate() ||
    hasDuration() ||
    hasEisenhower() ||
    hasDescription();
  const shouldRunDropSettling = () =>
    Boolean(props.dropSettling) && variant() === "overlay";
  const formattedDueDate = () => {
    if (!props.task.dueDate) return "";
    const date = new Date(`${props.task.dueDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    if (date.getFullYear() !== now.getFullYear()) {
      options.year = "numeric";
    }
    return date.toLocaleDateString("en-US", options);
  };

  let pointerStart: { x: number; y: number; id: number } | null = null;

  const handlePointerDown = (event: PointerEvent) => {
    if (variant() !== "normal") return;
    if (event.button !== 0) return;
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (variant() !== "normal") return;
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    pointerStart = null;
    if (distance > 4) return;
    if (isDragging()) return;
    props.onOpen?.(props.task.id);
  };

  const handlePointerCancel = () => {
    pointerStart = null;
  };

  return (
    <div
      class={`${taskCardClasses({
        category: category(),
        variant: variant(),
        settling: shouldRunDropSettling(),
      })} ${isPassiveVariant() ? "pointer-events-none" : ""}`.trim()}
      data-status={props.task.status}
      data-category={props.task.category ?? undefined}
      data-task-card="true"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div class="flex items-start gap-2">
        <Show when={hasSubtasks() && variant() === "normal"}>
          <button
            data-no-drag="true"
            type="button"
            class="mt-[2px] flex-none flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink-muted)_8%,transparent)] text-(--ink-muted) hover:bg-[color-mix(in_srgb,var(--ink-muted)_18%,transparent)] hover:text-(--ink) transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleCollapse?.(props.task.id);
            }}
          >
            <svg
              viewBox="0 0 16 16"
              class={`h-3 w-3 transition-transform ${props.task.isCollapsed ? "" : "rotate-90"}`}
              fill="currentColor"
            >
              <path d="M6 3l5 5-5 5z" />
            </svg>
          </button>
        </Show>
        <div class={`flex-1 min-w-0 ${taskTitleClasses({ ghost: isGhostVariant() })}`}>
          {props.task.title}
        </div>
      </div>
      <Show when={hasMeta()}>
        <div class={taskMetaClasses()}>
          <Show when={hasEisenhower()}>
            <div
              class={eisenhowerBadgeClasses({ quadrant: quadrant()! })}
              title={EISENHOWER_LABELS[quadrant()!]}
            >
              <div class={eisenhowerGridClasses()}>
                <div
                  class={eisenhowerCellClasses({ active: quadrant() === "do" })}
                />
                <div
                  class={eisenhowerCellClasses({
                    active: quadrant() === "schedule",
                  })}
                />
                <div
                  class={eisenhowerCellClasses({
                    active: quadrant() === "delegate",
                  })}
                />
                <div
                  class={eisenhowerCellClasses({
                    active: quadrant() === "eliminate",
                  })}
                />
              </div>
              <span class={badgeLabelClasses()}>
                {EISENHOWER_LABELS[quadrant()!]}
              </span>
            </div>
          </Show>
          <Show when={hasDueDate()}>
            <div class={dueBadgeClasses({ urgency: dueUrgency() })}>
              Due {formattedDueDate()}
            </div>
          </Show>
          <Show when={hasDuration()}>
            <div class={badgeClasses({ kind: "time" })}>
              {totalDurationLabel()}
            </div>
          </Show>
          <Show when={hasDescription()}>
            <span
              class={taskIndicatorClasses()}
              role="img"
              aria-label="Has description"
              title="Has description"
            >
              <svg
                viewBox="0 0 16 16"
                class={taskIndicatorIconClasses()}
                aria-hidden="true"
              >
                <path
                  d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.35"
                />
                <path
                  d="M9 2.5v3h3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.35"
                />
                <path
                  d="M6 8h4M6 10h3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
              </svg>
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
};
