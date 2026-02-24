import {
  type Component,
  type JSX,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { cva } from "class-variance-authority";
import { Inbox } from "./Inbox";
import { Notes } from "./Notes";
import { Board } from "./Board";
import { Calendar } from "./Calendar";
import { DragOverlay } from "./DragOverlay";
import { TaskEditorModal } from "./TaskEditorModal";
import { DraftSlotEditorModal } from "./DraftSlotEditorModal";
import { useCalendarStore } from "../store/calendarStore";
import {
  MODES,
  THEMES,
  type ModeId,
  type ThemeId,
  applyMode,
  applyTheme,
  getInitialMode,
  getInitialTheme,
} from "../theme";
import {
  CATEGORY_OPTIONS,
  type CategoryId,
  type PriorityLevel,
  useTaskStore,
} from "../store/taskStore";

type ViewVisibilityState = {
  inbox: boolean;
  notes: boolean;
  board: boolean;
  calendar: boolean;
};
type TaskModalSource = "existing-task" | "add-card";
type DashboardProps = {
  initialTaskId?: string | null;
  initialTaskSource?: TaskModalSource;
};
type TaskEditorSnapshot = {
  taskId: string;
  title: string;
  description: string;
  dueDate: string | null;
  category: CategoryId | null;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  categoryLabels: Record<CategoryId, string>;
};

const VIEW_VISIBILITY_STORAGE_KEY = "timeblocks-view-visibility";

const DEFAULT_VIEW_VISIBILITY: ViewVisibilityState = {
  inbox: true,
  notes: true,
  board: true,
  calendar: true,
};

const readViewVisibility = (): ViewVisibilityState => {
  if (typeof window === "undefined") return DEFAULT_VIEW_VISIBILITY;
  const stored = window.localStorage.getItem(VIEW_VISIBILITY_STORAGE_KEY);
  if (!stored) return DEFAULT_VIEW_VISIBILITY;

  try {
    const parsed = JSON.parse(stored) as Partial<ViewVisibilityState> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_VIEW_VISIBILITY;

    return {
      inbox:
        typeof parsed.inbox === "boolean"
          ? parsed.inbox
          : DEFAULT_VIEW_VISIBILITY.inbox,
      notes:
        typeof parsed.notes === "boolean"
          ? parsed.notes
          : DEFAULT_VIEW_VISIBILITY.notes,
      board:
        typeof parsed.board === "boolean"
          ? parsed.board
          : DEFAULT_VIEW_VISIBILITY.board,
      calendar:
        typeof parsed.calendar === "boolean"
          ? parsed.calendar
          : DEFAULT_VIEW_VISIBILITY.calendar,
    };
  } catch {
    return DEFAULT_VIEW_VISIBILITY;
  }
};

const saveViewVisibility = (visibility: ViewVisibilityState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    VIEW_VISIBILITY_STORAGE_KEY,
    JSON.stringify(visibility),
  );
};

// Tailwind class constants for shared, stateless elements

const THEME_SELECT_CLASSES =
  "min-w-[160px] py-[0.55rem] px-[0.9rem] pr-[2.8rem] rounded-[var(--radius-input)] border-2 border-[var(--select-border,var(--outline))] [background-color:var(--surface-solid)] text-[var(--ink)] [font-family:var(--font-body)] font-semibold shadow-[var(--shadow-tile),var(--select-glow)] appearance-none [background-image:linear-gradient(45deg,transparent_50%,var(--select-caret,var(--ink))_50%),linear-gradient(135deg,var(--select-caret,var(--ink))_50%,transparent_50%)] [background-position:calc(100%_-_1.2rem)_55%,calc(100%_-_0.85rem)_55%] [background-size:0.45rem_0.45rem] bg-no-repeat transition-[transform,box-shadow,border-color] [transition-duration:var(--speed-fast)] ease focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)] focus-visible:[outline-offset:var(--focus-ring-width)] focus-visible:-translate-y-px";

const PANEL_BASE =
  "flex min-w-0 min-h-0 [&>*]:flex-1 [&>*]:min-w-0 [&>*]:min-h-0 backdrop-blur-lg rounded-[var(--radius-card)]";

const inboxPanelClasses = cva(
  `${PANEL_BASE} min-h-64 dashboard-two-col:flex-1 dashboard-two-col:min-h-0`,
  {
    variants: {
      wide: {
        "two-visible":
          "dashboard-wide-two:[flex:0_0_20rem] dashboard-wide-two:w-auto dashboard-wide-two:mx-0",
        "three-visible":
          "dashboard-wide-three:[flex:0_0_20rem] dashboard-wide-three:w-auto dashboard-wide-three:mx-0",
        "four-visible":
          "dashboard-wide-four:[flex:0_0_20rem] dashboard-wide-four:w-auto dashboard-wide-four:mx-0",
      },
    },
    defaultVariants: {
      wide: "four-visible",
    },
  },
);

const notesPanelClasses = cva(
  `${PANEL_BASE} min-h-64 dashboard-two-col:flex-1 dashboard-two-col:min-h-0`,
  {
    variants: {
      wide: {
        "two-visible":
          "dashboard-wide-two:[flex:0_0_24rem] dashboard-wide-two:w-auto dashboard-wide-two:mx-0",
        "three-visible":
          "dashboard-wide-three:[flex:0_0_24rem] dashboard-wide-three:w-auto dashboard-wide-three:mx-0",
        "four-visible":
          "dashboard-wide-four:[flex:0_0_24rem] dashboard-wide-four:w-auto dashboard-wide-four:mx-0",
      },
    },
    defaultVariants: {
      wide: "four-visible",
    },
  },
);

// CVA definitions for layout-variant elements

const dashboardViewsClasses = cva(
  "flex-1 min-h-0 flex flex-col gap-4 overflow-visible pb-2",
  {
    variants: {
      layout: {
        "split-two-visible":
          "dashboard-two-col:grid dashboard-two-col:[grid-template-columns:minmax(240px,24rem)_minmax(320px,1fr)] dashboard-two-col:items-stretch dashboard-two-col:justify-center",
        "split-three-visible":
          "dashboard-two-col:grid dashboard-two-col:[grid-template-columns:minmax(240px,24rem)_minmax(320px,1fr)] dashboard-two-col:items-stretch dashboard-two-col:justify-center",
        "split-four-visible":
          "dashboard-two-col:grid dashboard-two-col:[grid-template-columns:minmax(240px,24rem)_minmax(320px,1fr)] dashboard-two-col:items-stretch dashboard-two-col:justify-center",
        "left-only":
          "dashboard-two-col:grid dashboard-two-col:[grid-template-columns:minmax(0,1fr)] dashboard-two-col:items-stretch dashboard-two-col:justify-center",
        "left-only-two-visible":
          "dashboard-two-col:grid dashboard-two-col:[grid-template-columns:repeat(2,minmax(0,1fr))] dashboard-two-col:items-stretch dashboard-two-col:justify-center",
        "right-only":
          "dashboard-two-col:grid dashboard-two-col:[grid-template-columns:minmax(0,1fr)] dashboard-two-col:items-stretch dashboard-two-col:justify-center",
      },
      wide: {
        "two-visible":
          "dashboard-wide-two:flex dashboard-wide-two:flex-row dashboard-wide-two:items-stretch dashboard-wide-two:justify-center",
        "three-visible":
          "dashboard-wide-three:flex dashboard-wide-three:flex-row dashboard-wide-three:items-stretch dashboard-wide-three:justify-center",
        "four-visible":
          "dashboard-wide-four:flex dashboard-wide-four:flex-row dashboard-wide-four:items-stretch dashboard-wide-four:justify-center",
      },
    },
    defaultVariants: {
      layout: "split-four-visible",
      wide: "four-visible",
    },
  },
);

const dashboardColumnClasses = cva("contents", {
  variants: {
    mode: {
      "flex-col":
        "dashboard-two-col:flex dashboard-two-col:flex-col dashboard-two-col:gap-4 dashboard-two-col:min-w-0 dashboard-two-col:min-h-0",
      "flex-row":
        "dashboard-two-col:flex dashboard-two-col:flex-row dashboard-two-col:items-stretch dashboard-two-col:justify-center",
      "contents-only": "",
    },
    wide: {
      "two-visible": "dashboard-wide-two:contents",
      "three-visible": "dashboard-wide-three:contents",
      "four-visible": "dashboard-wide-four:contents",
    },
  },
  defaultVariants: {
    mode: "flex-col",
    wide: "four-visible",
  },
});

const calendarPanelClasses = cva(
  `${PANEL_BASE} min-h-[19rem] dashboard-two-col:min-h-0`,
  {
    variants: {
      mode: {
        solo: "dashboard-two-col:flex-1",
        "with-board-split": "dashboard-two-col:flex-1",
        "with-board-row":
          "dashboard-wide-two:[flex:1_1_240px] dashboard-wide-two:min-w-[240px] dashboard-wide-two:max-w-[1000px]",
      },
      wide: {
        "two-visible":
          "dashboard-wide-two:min-w-[240px] dashboard-wide-two:max-w-[1000px]",
        "three-visible":
          "dashboard-wide-three:min-w-[240px] dashboard-wide-three:max-w-[1000px]",
        "four-visible":
          "dashboard-wide-four:min-w-[240px] dashboard-wide-four:max-w-[1000px]",
      },
    },
    compoundVariants: [
      {
        mode: "solo",
        wide: "two-visible",
        class: "dashboard-wide-two:[flex:1_1_40rem]",
      },
      {
        mode: "solo",
        wide: "three-visible",
        class: "dashboard-wide-three:[flex:1_1_40rem]",
      },
      {
        mode: "solo",
        wide: "four-visible",
        class: "dashboard-wide-four:[flex:1_1_40rem]",
      },
      {
        mode: "with-board-split",
        wide: "two-visible",
        class: "dashboard-wide-two:[flex:1_1_240px]",
      },
      {
        mode: "with-board-split",
        wide: "three-visible",
        class: "dashboard-wide-three:[flex:1_1_240px]",
      },
      {
        mode: "with-board-split",
        wide: "four-visible",
        class: "dashboard-wide-four:[flex:1_1_240px]",
      },
      {
        mode: "with-board-row",
        wide: "two-visible",
        class: "dashboard-wide-two:[flex:1_1_240px]",
      },
      {
        mode: "with-board-row",
        wide: "three-visible",
        class: "dashboard-wide-three:[flex:1_1_240px]",
      },
      {
        mode: "with-board-row",
        wide: "four-visible",
        class: "dashboard-wide-four:[flex:1_1_240px]",
      },
    ],
    defaultVariants: {
      mode: "solo",
      wide: "four-visible",
    },
  },
);

const boardPanelClasses = cva(
  `${PANEL_BASE} min-h-[19rem] w-full max-w-none dashboard-two-col:min-h-0`,
  {
    variants: {
      mode: {
        solo: "dashboard-two-col:flex-auto dashboard-two-col:self-stretch",
        "with-calendar-split": "dashboard-two-col:flex-1",
        "with-calendar-row":
          "dashboard-wide-two:[flex:1_1_320px] dashboard-wide-two:min-w-[min(320px,100%)]",
      },
      wide: {
        "two-visible":
          "dashboard-wide-two:[flex:0_1_var(--board-panel-max-width)] dashboard-wide-two:w-[min(100%,var(--board-panel-max-width))] dashboard-wide-two:max-w-[var(--board-panel-max-width)] dashboard-wide-two:min-w-[320px] dashboard-wide-two:self-stretch",
        "three-visible":
          "dashboard-wide-three:[flex:0_1_var(--board-panel-max-width)] dashboard-wide-three:w-[min(100%,var(--board-panel-max-width))] dashboard-wide-three:max-w-[var(--board-panel-max-width)] dashboard-wide-three:min-w-[320px] dashboard-wide-three:self-stretch",
        "four-visible":
          "dashboard-wide-four:[flex:0_1_var(--board-panel-max-width)] dashboard-wide-four:w-[min(100%,var(--board-panel-max-width))] dashboard-wide-four:max-w-[var(--board-panel-max-width)] dashboard-wide-four:min-w-[320px] dashboard-wide-four:self-stretch",
      },
    },
    defaultVariants: {
      mode: "solo",
      wide: "four-visible",
    },
  },
);

const toggleBtnClasses = cva(
  "cursor-pointer rounded-full border-2 border-(--outline) px-[1.15rem] py-2 [font-family:var(--font-body)] font-bold text-[0.88rem] tracking-[0.02em] transition-[transform,box-shadow,background,border-color,color] [transition-duration:var(--speed-fast)] ease outline-none hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)] focus-visible:[outline-offset:var(--focus-ring-width)]",
  {
    variants: {
      active: {
        true: "border-[var(--brand)] bg-[var(--brand)] text-white shadow-[0_2px_8px_color-mix(in_srgb,var(--brand)_25%,transparent)] hover:shadow-[0_4px_14px_color-mix(in_srgb,var(--brand)_35%,transparent)]",
        false:
          "border-transparent bg-transparent text-[var(--ink-muted)] shadow-none hover:border-(--outline) hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-[var(--ink)]",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

const dockBarClasses = cva(
  "pointer-events-auto mx-auto flex max-w-[min(100%,96rem)] items-center justify-center gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-full border-2 border-[var(--dock-border,var(--outline))] bg-[var(--dock-bg)] p-3 shadow-[var(--shadow-soft),var(--dock-glow)] backdrop-blur-[12px] [animation:floatUp_var(--speed-slow)_ease_both]",
);

const animatedPanelClasses = cva("", {
  variants: {
    exiting: {
      true: "[animation:floatOut_var(--speed-slow)_ease_both]",
      false:
        "[animation:floatIn_var(--speed-slow)_ease_both] [animation-delay:var(--enter-delay,0ms)]",
    },
  },
  defaultVariants: {
    exiting: false,
  },
});

import { exportData, importData } from "../utils/dataTransfer";

export const Dashboard: Component<DashboardProps> = (props) => {
  const [state, actions] = useTaskStore();
  const initialVisibility = readViewVisibility();

  // Visibility toggles
  const [showInbox, setShowInbox] = createSignal(initialVisibility.inbox);
  const [showNotes, setShowNotes] = createSignal(initialVisibility.notes);
  const [showBoard, setShowBoard] = createSignal(initialVisibility.board);
  const [showCalendar, setShowCalendar] = createSignal(
    initialVisibility.calendar,
  );
  const [activeTheme, setActiveTheme] =
    createSignal<ThemeId>(getInitialTheme());
  const [activeMode, setActiveMode] = createSignal<ModeId>(getInitialMode());
  const [activeTaskId, setActiveTaskId] = createSignal<string | null>(null);
  const [activeTaskSource, setActiveTaskSource] =
    createSignal<TaskModalSource>("existing-task");
  const [didOpenInitialTask, setDidOpenInitialTask] = createSignal(false);
  const [taskEditorSnapshot, setTaskEditorSnapshot] =
    createSignal<TaskEditorSnapshot | null>(null);
  const [activeDraftSlotId, setActiveDraftSlotId] = createSignal<string | null>(
    null,
  );
  const [calendarState, calendarActions] = useCalendarStore();
  const isCalendarConnected = () =>
    !!calendarState.accessToken && Date.now() < calendarState.tokenExpiresAt;

  const captureTaskEditorSnapshot = (
    taskId: string,
  ): TaskEditorSnapshot | null => {
    const context = actions.getTaskContext(taskId);
    if (!context) return null;
    const current = context.task;
    return {
      taskId: current.id,
      title: current.title,
      description: current.description ?? "",
      dueDate: current.dueDate ?? null,
      category: current.category ?? null,
      importance: current.importance ?? "none",
      urgency: current.urgency ?? "none",
      categoryLabels: { ...state.categoryLabels },
    };
  };

  const resetTaskEditor = () => {
    setActiveTaskId(null);
    setActiveTaskSource("existing-task");
    setTaskEditorSnapshot(null);
  };

  const openTaskEditor = (
    taskId: string,
    source: TaskModalSource = "existing-task",
  ) => {
    setTaskEditorSnapshot(
      source === "existing-task" ? captureTaskEditorSnapshot(taskId) : null,
    );
    setActiveTaskId(taskId);
    setActiveTaskSource(source);
  };

  const saveTaskEditor = () => {
    resetTaskEditor();
  };

  const cancelTaskEditor = () => {
    const currentTaskId = activeTaskId();
    const currentSource = activeTaskSource();
    const snapshot = taskEditorSnapshot();

    if (currentTaskId) {
      if (currentSource === "add-card") {
        actions.deleteTask(currentTaskId);
      } else if (snapshot?.taskId === currentTaskId) {
        actions.updateTask(currentTaskId, {
          title: snapshot.title,
          description: snapshot.description,
          dueDate: snapshot.dueDate,
          category: snapshot.category,
          importance: snapshot.importance,
          urgency: snapshot.urgency,
        });
        for (const option of CATEGORY_OPTIONS) {
          actions.updateCategoryLabel(
            option.id,
            snapshot.categoryLabels[option.id],
          );
        }
      }
    }

    resetTaskEditor();
  };

  const openDraftSlotEditor = (slotId: string) => {
    setActiveDraftSlotId(slotId);
  };

  const closeDraftSlotEditor = () => {
    setActiveDraftSlotId(null);
  };

  const deleteDraftSlotFromEditor = (slotId: string) => {
    actions.removeCalendarDraftSlot(slotId);
    setActiveDraftSlotId(null);
  };

  const convertDraftSlotToTask = (slotId: string) => {
    const taskId = actions.convertDraftSlotToTask(slotId);
    setActiveDraftSlotId(null);
    if (taskId) {
      openTaskEditor(taskId);
    }
  };

  createEffect(() => {
    if (didOpenInitialTask()) return;
    if (!props.initialTaskId) return;
    openTaskEditor(
      props.initialTaskId,
      props.initialTaskSource ?? "existing-task",
    );
    setDidOpenInitialTask(true);
  });

  createEffect(() => {
    applyTheme(activeTheme());
  });

  createEffect(() => {
    applyMode(activeMode());
  });

  createEffect(() => {
    saveViewVisibility({
      inbox: showInbox(),
      notes: showNotes(),
      board: showBoard(),
      calendar: showCalendar(),
    });
  });

  const hasLeftViews = () => showInbox() || showNotes();
  const hasRightViews = () => showCalendar() || showBoard();
  const visibleViewCount = () =>
    Number(showInbox()) +
    Number(showNotes()) +
    Number(showCalendar()) +
    Number(showBoard());

  const viewsLayout = () => {
    if (hasLeftViews() && hasRightViews()) {
      if (visibleViewCount() === 4) return "split-four-visible" as const;
      if (visibleViewCount() === 3) return "split-three-visible" as const;
      return "split-two-visible" as const;
    }
    if (!hasRightViews()) {
      return visibleViewCount() === 2
        ? ("left-only-two-visible" as const)
        : ("left-only" as const);
    }
    return "right-only" as const;
  };

  const wideLayout = () => {
    if (visibleViewCount() >= 4) return "four-visible" as const;
    if (visibleViewCount() === 3) return "three-visible" as const;
    return "two-visible" as const;
  };

  const leftColumnMode = () => {
    if (!hasRightViews() && visibleViewCount() === 2)
      return "contents-only" as const;
    return "flex-col" as const;
  };

  const rightColumnMode = () => {
    return "flex-col" as const;
  };

  const calendarMode = () => {
    if (!showBoard()) return "solo" as const;
    if (!hasLeftViews() && visibleViewCount() === 2)
      return "with-board-row" as const;
    return "with-board-split" as const;
  };

  const boardMode = () => {
    if (!showCalendar()) return "solo" as const;
    if (!hasLeftViews() && visibleViewCount() === 2)
      return "with-calendar-row" as const;
    return "with-calendar-split" as const;
  };

  const [now, setNow] = createSignal(new Date());
  let clockRaf: number;
  const tickClock = () => {
    setNow(new Date());
    clockRaf = requestAnimationFrame(tickClock);
  };
  clockRaf = requestAnimationFrame(tickClock);
  onCleanup(() => cancelAnimationFrame(clockRaf));

  const secondAngle = () =>
    now().getSeconds() * 6 + now().getMilliseconds() * 0.006;
  const minuteAngle = () => now().getMinutes() * 6 + now().getSeconds() * 0.1;
  const hourAngle = () =>
    (now().getHours() % 12) * 30 + now().getMinutes() * 0.5;

  return (
    <div class="h-screen flex flex-col gap-4 px-4 pt-6 overflow-visible [--dashboard-dock-offset:max(0.75rem,env(safe-area-inset-bottom))] [--dashboard-dock-reserve:5.35rem] [--board-panel-max-width:1024px] pb-[calc(var(--dashboard-dock-offset)+var(--dashboard-dock-reserve))]">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="relative h-[46px] w-[46px] rounded-[10px] border-[3px] border-[var(--ink)] overflow-hidden shrink-0">
            <div class="absolute inset-0 [background-color:var(--bg)] [background-image:var(--bg-pattern)] bg-cover" />
            <div class="absolute inset-0 [background-image:var(--sky-overlay)] [background-size:var(--sky-overlay-size)] [background-position:var(--sky-overlay-position)] [background-repeat:var(--sky-overlay-repeat)] [opacity:var(--sky-overlay-opacity)]" />
            <div class="absolute bottom-0 left-0 right-0 h-[33%] [background-image:var(--ground-overlay)] [background-size:var(--ground-overlay-size)] [background-position:var(--ground-overlay-position)] [background-repeat:var(--ground-overlay-repeat)] [opacity:var(--ground-overlay-opacity)] [filter:var(--ground-overlay-filter)]" />
            <svg
              class="absolute inset-0 h-full w-full text-[var(--ink)]"
              viewBox="0 0 46 46"
              fill="none"
            >
              <line
                x1="23"
                y1="23"
                x2="23"
                y2="10"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                transform={`rotate(${hourAngle()} 23 23)`}
              />
              <line
                x1="23"
                y1="23"
                x2="23"
                y2="7"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                transform={`rotate(${minuteAngle()} 23 23)`}
              />
              <line
                x1="23"
                y1="23"
                x2="23"
                y2="5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                transform={`rotate(${secondAngle()} 23 23)`}
              />
              <circle cx="23" cy="23" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-semibold">TimeBlocks</div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-3">
            <label
              for="theme-select"
              class="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)]"
            >
              Theme
            </label>
            <select
              id="theme-select"
              class={THEME_SELECT_CLASSES}
              value={activeTheme()}
              onChange={(event) =>
                setActiveTheme(event.currentTarget.value as ThemeId)
              }
            >
              <For each={THEMES}>
                {(theme) => <option value={theme.id}>{theme.label}</option>}
              </For>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <label
              for="mode-select"
              class="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)]"
            >
              Mode
            </label>
            <select
              id="mode-select"
              class={THEME_SELECT_CLASSES}
              value={activeMode()}
              onChange={(event) =>
                setActiveMode(event.currentTarget.value as ModeId)
              }
            >
              <For each={MODES}>
                {(mode) => <option value={mode.id}>{mode.label}</option>}
              </For>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="cursor-pointer rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[1.15rem] py-2 font-body text-[0.88rem] font-bold tracking-[0.02em] transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)] focus-visible:[outline-offset:var(--focus-ring-width)] text-(--ink-muted) hover:text-(--ink) hover:border-(--outline)"
              onClick={() => importData()}
            >
              Import
            </button>
            <button
              class="cursor-pointer rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[1.15rem] py-2 font-body text-[0.88rem] font-bold tracking-[0.02em] transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)] focus-visible:[outline-offset:var(--focus-ring-width)] text-(--ink-muted) hover:text-(--ink) hover:border-(--outline)"
              onClick={() => exportData()}
            >
              Export
            </button>
            <Show
              when={isCalendarConnected()}
              fallback={
                <button
                  class="cursor-pointer rounded-full border-2 border-(--danger) bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface-solid))] px-[1.15rem] py-2 font-body text-[0.88rem] font-bold tracking-[0.02em] transition-[transform,box-shadow,border-color,background,color] duration-(--speed-fast) hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--danger)_15%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)] focus-visible:outline-offset-(--focus-ring-width) text-(--danger)"
                  onClick={() => calendarActions.connect()}
                  disabled={calendarState.isLoading}
                >
                  {calendarState.isLoading ? "Connecting..." : "Sync Calendar"}
                </button>
              }
            >
              <button
                class="cursor-pointer rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[1.15rem] py-2 font-body text-[0.88rem] font-bold tracking-[0.02em] transition-[transform,box-shadow,border-color,background,color] duration-(--speed-fast) hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)] focus-visible:outline-offset-(--focus-ring-width) text-(--ink-muted) hover:text-(--ink) hover:border-(--outline)"
                onClick={() => calendarActions.disconnect()}
              >
                Disconnect Calendar
              </button>
            </Show>
          </div>
        </div>
      </header>

      <div
        class={dashboardViewsClasses({
          layout: viewsLayout(),
          wide: wideLayout(),
        })}
      >
        <Show when={hasLeftViews()}>
          <div
            class={dashboardColumnClasses({
              mode: leftColumnMode(),
              wide: wideLayout(),
            })}
          >
            <AnimatedPanel
              when={showInbox()}
              delay={40}
              class={inboxPanelClasses({ wide: wideLayout() })}
            >
              <Inbox onOpenTask={openTaskEditor} />
            </AnimatedPanel>

            <AnimatedPanel
              when={showNotes()}
              delay={80}
              class={notesPanelClasses({ wide: wideLayout() })}
            >
              <Notes />
            </AnimatedPanel>
          </div>
        </Show>

        <Show when={hasRightViews()}>
          <div
            class={dashboardColumnClasses({
              mode: rightColumnMode(),
              wide: wideLayout(),
            })}
          >
            <AnimatedPanel
              when={showCalendar()}
              delay={120}
              class={calendarPanelClasses({
                mode: calendarMode(),
                wide: wideLayout(),
              })}
            >
              <Calendar
                onOpenTask={openTaskEditor}
                onOpenDraftSlot={openDraftSlotEditor}
              />
            </AnimatedPanel>

            <AnimatedPanel
              when={showBoard()}
              delay={200}
              class={boardPanelClasses({
                mode: boardMode(),
                wide: wideLayout(),
              })}
            >
              <Board onOpenTask={openTaskEditor} />
            </AnimatedPanel>
          </div>
        </Show>
      </div>

      <DragOverlay />
      <TaskEditorModal
        taskId={activeTaskId()}
        showSaveButton={activeTaskSource() === "add-card"}
        onCancel={cancelTaskEditor}
        onSave={saveTaskEditor}
      />
      <DraftSlotEditorModal
        slotId={activeDraftSlotId()}
        onClose={closeDraftSlotEditor}
        onDelete={deleteDraftSlotFromEditor}
        onConvertToTask={convertDraftSlotToTask}
      />
      <div
        class="fixed left-0 right-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3 pointer-events-none"
        aria-label="View toggles"
      >
        <div class={dockBarClasses()}>
          <ToggleBtn
            label="Inbox"
            active={showInbox()}
            onClick={() => setShowInbox(!showInbox())}
          />
          <ToggleBtn
            label="Notes"
            active={showNotes()}
            onClick={() => setShowNotes(!showNotes())}
          />
          <ToggleBtn
            label="Calendar"
            active={showCalendar()}
            onClick={() => setShowCalendar(!showCalendar())}
          />
          <ToggleBtn
            label="Board"
            active={showBoard()}
            onClick={() => setShowBoard(!showBoard())}
          />
        </div>
      </div>
    </div>
  );
};

const AnimatedPanel: Component<{
  when: boolean;
  delay?: number;
  class?: string;
  children: JSX.Element;
}> = (props) => {
  const [mounted, setMounted] = createSignal(props.when);
  const [exiting, setExiting] = createSignal(false);

  createEffect(() => {
    if (props.when) {
      setMounted(true);
      setExiting(false);
      return;
    }

    if (mounted()) {
      setExiting(true);
    }
  });

  const handleAnimationEnd: JSX.EventHandlerUnion<
    HTMLDivElement,
    AnimationEvent
  > = (event) => {
    if (!exiting()) return;
    if (event.target !== event.currentTarget) return;
    setMounted(false);
    setExiting(false);
  };

  return (
    <Show when={mounted()}>
      <div
        class={[props.class, animatedPanelClasses({ exiting: exiting() })]
          .filter(Boolean)
          .join(" ")}
        style={
          props.delay !== undefined
            ? `--enter-delay: ${props.delay}ms;`
            : undefined
        }
        onAnimationEnd={handleAnimationEnd}
      >
        {props.children}
      </div>
    </Show>
  );
};

const ToggleBtn: Component<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = (props) => (
  <button
    onClick={props.onClick}
    class={toggleBtnClasses({ active: props.active })}
    data-active={props.active}
    aria-pressed={props.active}
    type="button"
  >
    {props.label}
  </button>
);
