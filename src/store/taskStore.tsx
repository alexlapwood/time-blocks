import { createStore, produce } from "solid-js/store";
import {
  createEffect,
  createContext,
  useContext,
  type ParentComponent,
} from "solid-js";
import {
  buildDateAtMinutes,
  formatLocalDate,
  getLocalDateId,
  getMinutesInDay,
  toDate,
} from "../utils/date";
import { resolveSchedule } from "../utils/calendarSchedule";
import {
  ceilToFifteen,
  stampRoutine,
  type StampingConflict,
} from "../utils/routineStamping";

export type TaskStatus = "inbox" | "todo" | "in_progress" | "note";

export type PriorityLevel = "none" | "low" | "high";

export const PRIORITY_OPTIONS: { id: PriorityLevel; label: string }[] = [
  { id: "none", label: "None" },
  { id: "low", label: "Low" },
  { id: "high", label: "High" },
];

export type CategoryId =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "greenblue"
  | "blue"
  | "purple";

export const CATEGORY_OPTIONS: { id: CategoryId; label: string }[] = [
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "greenblue", label: "Teal" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
];

const CATEGORY_IDS = new Set(CATEGORY_OPTIONS.map((option) => option.id));
const PRIORITY_IDS = new Set(PRIORITY_OPTIONS.map((option) => option.id));

const createDefaultCategoryLabels = (): Record<CategoryId, string> => ({
  red: "",
  orange: "",
  yellow: "",
  green: "",
  greenblue: "",
  blue: "",
  purple: "",
});

export type ScheduledTime = {
  id: string;
  start: Date | string;
  duration: number; // minutes
};

export type CalendarDraftSlot = {
  id: string;
  title: string;
  start: Date | string;
  duration: number; // minutes
  category?: CategoryId | null;
  description?: string;
  dueDate?: string | null;
  importance?: PriorityLevel;
  urgency?: PriorityLevel;
  templateItemId?: string;
};

// 0..6 matching Date.getDay() (0 = Sunday).
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RoutineItem = {
  id: string;
  title: string;
  duration: number; // minutes
  homeDay: Weekday;
  startMinutes: number; // 0..1439, position within the day
  repeatDays: Weekday[]; // weekdays excluding the home day
  category?: CategoryId | null;
  description?: string;
  dueDate?: string | null;
  importance?: PriorityLevel;
  urgency?: PriorityLevel;
};

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
  dueDate?: string | null;
  category?: CategoryId | null;
  importance?: PriorityLevel;
  urgency?: PriorityLevel;
  parentId?: string;
  subtasks: Task[];
  scheduledTimes: ScheduledTime[];
  isCollapsed?: boolean;
  isDone?: boolean;
  completedAt?: string;
  isArchived?: boolean;
};

function findTaskById(tasks: Task[], id: string): Task | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    if (task.subtasks.length > 0) {
      const found = findTaskById(task.subtasks, id);
      if (found) return found;
    }
  }
  return null;
}

export function getEffectiveCategory(
  allTasks: Task[],
  task: Task,
): CategoryId | null {
  if (task.category) return task.category;
  if (!task.parentId) return null;
  const parent = findTaskById(allTasks, task.parentId);
  if (!parent) return null;
  return getEffectiveCategory(allTasks, parent);
}

export function isEffectivelyDone(task: Task): boolean {
  if (task.isDone) return true;
  if (task.subtasks.length === 0) return false;
  return task.subtasks.every(isEffectivelyDone);
}

// Pre-order walk over `task` and every descendant. The single recursion
// mechanism the subtree-mutating helpers below build on — keeping the
// recursion in one place so each caller reads as a single statement of intent.
function walkSubtree(task: Task, visit: (task: Task) => void): void {
  visit(task);
  for (const subtask of task.subtasks) {
    walkSubtree(subtask, visit);
  }
}

// Rewrite the status of `task` and every descendant in-place. Single source of
// truth for the subtree-status invariant: a task's status always equals its
// root's status, so cross-panel and re-parent operations must walk the tree.
export function setSubtreeStatus(task: Task, status: TaskStatus): void {
  walkSubtree(task, (t) => {
    t.status = status;
  });
}

export type TaskStoreState = {
  tasks: Task[];
  calendarDraftSlots: CalendarDraftSlot[];
  categoryLabels: Record<CategoryId, string>;
  weeklyTemplate: RoutineItem[];
};

const STORAGE_KEY = "timeblocks-tasks";
const DEFAULT_SLOT_DURATION = 30;
export const DEFAULT_CALENDAR_DRAFT_TITLE = "New slot";

function createTaskStoreModel() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let initialState: TaskStoreState = {
    tasks: [],
    calendarDraftSlots: [],
    categoryLabels: createDefaultCategoryLabels(),
    weeklyTemplate: [],
  };
  try {
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        initialState = {
          ...initialState,
          ...parsed,
        };
      }
    }
  } catch (e) {
    console.error("Failed to load tasks", e);
  }

  const coerceStatus = (value: unknown): TaskStatus => {
    switch (value) {
      case "inbox":
      case "todo":
      case "in_progress":
      case "note":
        return value;
      case "scheduled":
        return "todo";
      case "done":
        return "in_progress";
      default:
        return "inbox";
    }
  };

  const normalizeSlot = (slot: any): ScheduledTime | null => {
    const start = slot?.start ?? slot?.scheduledTime ?? slot?.time;
    if (!start) return null;
    const duration =
      typeof slot?.duration === "number"
        ? slot.duration
        : typeof slot?.estimatedDuration === "number"
          ? slot.estimatedDuration
          : DEFAULT_SLOT_DURATION;
    return {
      id:
        typeof slot?.id === "string" && slot.id ? slot.id : crypto.randomUUID(),
      start,
      duration,
    };
  };

  const normalizeCalendarDraftSlot = (slot: any): CalendarDraftSlot | null => {
    const start = slot?.start ?? slot?.scheduledTime ?? slot?.time;
    if (!start) return null;
    const duration =
      typeof slot?.duration === "number"
        ? slot.duration
        : typeof slot?.estimatedDuration === "number"
          ? slot.estimatedDuration
          : DEFAULT_SLOT_DURATION;
    const title =
      typeof slot?.title === "string"
        ? slot.title
        : DEFAULT_CALENDAR_DRAFT_TITLE;
    const category =
      typeof slot?.category === "string" && CATEGORY_IDS.has(slot.category)
        ? (slot.category as CategoryId)
        : null;
    const description =
      typeof slot?.description === "string" ? slot.description : "";
    const dueDate = typeof slot?.dueDate === "string" ? slot.dueDate : null;
    const normalizePriority = (value: unknown): PriorityLevel => {
      if (value === "medium") return "low";
      if (typeof value !== "string") return "none";
      return PRIORITY_IDS.has(value as PriorityLevel)
        ? (value as PriorityLevel)
        : "none";
    };
    const importance = normalizePriority(slot?.importance);
    const urgency = normalizePriority(slot?.urgency);
    const templateItemId =
      typeof slot?.templateItemId === "string" && slot.templateItemId
        ? slot.templateItemId
        : undefined;
    return {
      id:
        typeof slot?.id === "string" && slot.id ? slot.id : crypto.randomUUID(),
      title: title.trim() ? title : DEFAULT_CALENDAR_DRAFT_TITLE,
      start,
      duration: duration > 0 ? duration : DEFAULT_SLOT_DURATION,
      category,
      description,
      dueDate,
      importance,
      urgency,
      templateItemId,
    };
  };

  const normalizeWeekday = (value: unknown): Weekday | null => {
    if (typeof value !== "number" || !Number.isInteger(value)) return null;
    if (value < 0 || value > 6) return null;
    return value as Weekday;
  };

  const normalizeRoutineItem = (item: any): RoutineItem | null => {
    if (!item || typeof item !== "object") return null;
    const homeDay = normalizeWeekday(item.homeDay);
    if (homeDay === null) return null;

    const startMinutes =
      typeof item.startMinutes === "number" &&
      item.startMinutes >= 0 &&
      item.startMinutes <= 1439
        ? item.startMinutes
        : 0;
    const duration =
      typeof item.duration === "number" && item.duration > 0
        ? item.duration
        : DEFAULT_SLOT_DURATION;
    const repeatDaysRaw = Array.isArray(item.repeatDays) ? item.repeatDays : [];
    const repeatDays = repeatDaysRaw
      .map(normalizeWeekday)
      .filter((day: Weekday | null): day is Weekday => day !== null && day !== homeDay);
    const category =
      typeof item.category === "string" && CATEGORY_IDS.has(item.category)
        ? (item.category as CategoryId)
        : null;
    const description =
      typeof item.description === "string" ? item.description : "";
    const dueDate = typeof item.dueDate === "string" ? item.dueDate : null;
    const normalizePriority = (value: unknown): PriorityLevel => {
      if (value === "medium") return "low";
      if (typeof value !== "string") return "none";
      return PRIORITY_IDS.has(value as PriorityLevel)
        ? (value as PriorityLevel)
        : "none";
    };
    const importance = normalizePriority(item.importance);
    const urgency = normalizePriority(item.urgency);
    return {
      id:
        typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      title: typeof item.title === "string" ? item.title : "",
      duration,
      homeDay,
      startMinutes,
      repeatDays,
      category,
      description,
      dueDate,
      importance,
      urgency,
    };
  };

  const normalizeTask = (task: any): Task => {
    const originalStatus = task?.status;
    const subtasks = Array.isArray(task?.subtasks)
      ? task.subtasks.map(normalizeTask)
      : [];
    let scheduledTimes: ScheduledTime[] = [];
    if (Array.isArray(task?.scheduledTimes)) {
      scheduledTimes = task.scheduledTimes
        .map(normalizeSlot)
        .filter((slot: ScheduledTime | null): slot is ScheduledTime => !!slot);
    } else if (task?.scheduledTime) {
      const slot = normalizeSlot({
        start: task.scheduledTime,
        duration: task.estimatedDuration,
      });
      if (slot) scheduledTimes = [slot];
    }

    const category =
      typeof task?.category === "string" && CATEGORY_IDS.has(task.category)
        ? (task.category as CategoryId)
        : null;
    const description =
      typeof task?.description === "string" ? task.description : "";
    const dueDate = typeof task?.dueDate === "string" ? task.dueDate : null;

    const normalizePriority = (value: unknown): PriorityLevel => {
      // Migrate older "medium" tasks to the new "low/high/none" model.
      if (value === "medium") return "low";
      if (typeof value !== "string") return "none";
      return PRIORITY_IDS.has(value as PriorityLevel)
        ? (value as PriorityLevel)
        : "none";
    };
    const importance = normalizePriority(task?.importance);
    const urgency = normalizePriority(task?.urgency);

    const wasDoneStatus = originalStatus === "done";
    const isDone =
      wasDoneStatus && subtasks.length === 0 ? true : !!task?.isDone;

    return {
      id:
        typeof task?.id === "string" && task.id ? task.id : crypto.randomUUID(),
      title: typeof task?.title === "string" ? task.title : "",
      status: coerceStatus(task?.status),
      description,
      dueDate,
      category,
      importance,
      urgency,
      parentId: typeof task?.parentId === "string" ? task.parentId : undefined,
      subtasks,
      scheduledTimes,
      isCollapsed: !!task?.isCollapsed,
      isDone,
      completedAt:
        typeof task?.completedAt === "string"
          ? task.completedAt
          : isDone
            ? new Date().toISOString()
            : undefined,
      isArchived: !!task?.isArchived,
    };
  };

  const normalizedTasks = Array.isArray(initialState.tasks)
    ? initialState.tasks.map(normalizeTask)
    : [];

  const normalizedCalendarDraftSlots = Array.isArray(
    initialState.calendarDraftSlots,
  )
    ? initialState.calendarDraftSlots
        .map(normalizeCalendarDraftSlot)
        .filter(
          (slot: CalendarDraftSlot | null): slot is CalendarDraftSlot => !!slot,
        )
    : [];

  const normalizedCategoryLabels = (() => {
    const defaults = createDefaultCategoryLabels();
    const storedLabels = (initialState as TaskStoreState)?.categoryLabels;
    if (storedLabels && typeof storedLabels === "object") {
      for (const option of CATEGORY_OPTIONS) {
        const value = (storedLabels as Record<string, unknown>)[option.id];
        if (typeof value === "string") {
          defaults[option.id] = value;
        }
      }
    }
    return defaults;
  })();

  const normalizedWeeklyTemplate: RoutineItem[] = Array.isArray(
    initialState.weeklyTemplate,
  )
    ? initialState.weeklyTemplate
        .map(normalizeRoutineItem)
        .filter((item: RoutineItem | null): item is RoutineItem => !!item)
    : [];

  const [state, setState] = createStore<TaskStoreState>({
    tasks: normalizedTasks,
    calendarDraftSlots: normalizedCalendarDraftSlots,
    categoryLabels: normalizedCategoryLabels,
    weeklyTemplate: normalizedWeeklyTemplate,
  });

  createEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });

  const archiveDoneRecursive = (tasks: Task[]) => {
    for (const task of tasks) {
      if (task.isArchived) continue;
      if (isEffectivelyDone(task)) {
        task.isArchived = true;
      } else if (task.subtasks.length > 0) {
        archiveDoneRecursive(task.subtasks);
      }
    }
  };

  const findTask = (
    tasks: Task[],
    id: string,
  ): [Task, Task[], number] | null => {
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id === id) {
        return [tasks[i], tasks, i];
      }
      if (tasks[i].subtasks.length > 0) {
        const result = findTask(tasks[i].subtasks, id);
        if (result) return result;
      }
    }
    return null;
  };

  const findSlot = (
    tasks: Task[],
    slotId: string,
  ): { slot: ScheduledTime; task: Task } | null => {
    for (const task of tasks) {
      const slot = task.scheduledTimes.find((entry) => entry.id === slotId);
      if (slot) return { slot, task };
      if (task.subtasks.length > 0) {
        const nested = findSlot(task.subtasks, slotId);
        if (nested) return nested;
      }
    }
    return null;
  };

  const findCalendarDraftSlot = (
    slots: CalendarDraftSlot[],
    slotId: string,
  ): CalendarDraftSlot | null => {
    return slots.find((slot) => slot.id === slotId) ?? null;
  };

  type ResolvableSlotRef = {
    id: string;
    start: Date | string;
    duration: number;
    setStart: (nextStart: Date) => void;
  };

  const collectTaskSlotsForDay = (
    tasks: Task[],
    dayId: string,
    slots: ResolvableSlotRef[],
  ) => {
    for (const task of tasks) {
      for (const slot of task.scheduledTimes) {
        if (getLocalDateId(slot.start) !== dayId) continue;
        slots.push({
          id: slot.id,
          start: slot.start,
          duration: slot.duration,
          setStart: (nextStart) => {
            slot.start = nextStart;
          },
        });
      }
      if (task.subtasks.length > 0) {
        collectTaskSlotsForDay(task.subtasks, dayId, slots);
      }
    }
  };

  const collectCalendarDraftSlotsForDay = (
    calendarDraftSlots: CalendarDraftSlot[],
    dayId: string,
    slots: ResolvableSlotRef[],
  ) => {
    for (const slot of calendarDraftSlots) {
      if (getLocalDateId(slot.start) !== dayId) continue;
      slots.push({
        id: slot.id,
        start: slot.start,
        duration: slot.duration,
        setStart: (nextStart) => {
          slot.start = nextStart;
        },
      });
    }
  };

  const collectSlotsForDay = (
    tasks: Task[],
    calendarDraftSlots: CalendarDraftSlot[],
    dayId: string,
    slots: ResolvableSlotRef[],
  ) => {
    collectTaskSlotsForDay(tasks, dayId, slots);
    collectCalendarDraftSlotsForDay(calendarDraftSlots, dayId, slots);
  };

  const resolveDaySchedule = (
    daySlots: ResolvableSlotRef[],
    baseDate: Date,
    priorityId?: string,
  ) => {
    if (daySlots.length === 0) return;
    const schedule = daySlots.map((slot) => {
      const time = toDate(slot.start) ?? baseDate;
      return {
        id: slot.id,
        startMinutes: getMinutesInDay(time),
        duration: slot.duration || DEFAULT_SLOT_DURATION,
      };
    });

    const resolved = resolveSchedule(schedule, priorityId);
    const byId = new Map(resolved.map((item) => [item.id, item.startMinutes]));

    for (const slot of daySlots) {
      const minutes = byId.get(slot.id);
      if (minutes === undefined) continue;
      slot.setStart(buildDateAtMinutes(baseDate, minutes));
    }
  };

  const actions = {
    getTaskContext: (taskId: string) => {
      const res = findTask(state.tasks, taskId);
      if (!res) return null;
      const [task, parentArray, index] = res;
      // Return shallow copy of task context to avoid accidental mutation
      return { task, parentArray, index };
    },

    addTask: (title: string, parentId?: string): string => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title,
        status: "inbox",
        description: "",
        dueDate: null,
        category: null,
        importance: "none",
        urgency: "none",
        subtasks: [],
        scheduledTimes: [],
        parentId,
      };

      setState(
        produce((s) => {
          if (parentId) {
            const res = findTask(s.tasks, parentId);
            if (res) {
              // Maintain the subtree-status invariant: a child of a parent
              // always adopts the parent's status on creation. Without this
              // a sub-note would be created as status="inbox" and break the
              // invariant relied on by panel filters and rendering.
              newTask.status = res[0].status;
              res[0].isCollapsed = false;
              res[0].subtasks.push(newTask);
            }
          } else {
            s.tasks.unshift(newTask);
          }
        }),
      );

      return newTask.id;
    },

    updateTask: (id: string, updates: Partial<Task>) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, id);
          if (res) {
            const [task] = res;
            const finalUpdates = { ...updates };
            if ("isDone" in finalUpdates) {
              finalUpdates.completedAt = finalUpdates.isDone
                ? new Date().toISOString()
                : undefined;
            }
            Object.assign(task, finalUpdates);
          }
        }),
      );
    },

    updateCategoryLabel: (categoryId: CategoryId, label: string) => {
      setState("categoryLabels", categoryId, label);
    },

    deleteTask: (id: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, id);
          if (res) {
            const [_, parentArray, index] = res;
            parentArray.splice(index, 1);
          }
        }),
      );
    },

    moveTask: (taskId: string, newParentId?: string) => {
      setState(
        produce((s) => {
          // 1. Find and remove from old location
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, oldParentArray, index] = res;

          // Remove from old parent
          oldParentArray.splice(index, 1);

          // Update task properties
          task.parentId = newParentId;

          // 2. Add to new location
          if (newParentId) {
            const parentRes = findTask(s.tasks, newParentId);
            if (parentRes) {
              parentRes[0].subtasks.push(task);
            } else {
              // If parent not found, add to root (fallback)
              s.tasks.push(task);
              task.parentId = undefined;
            }
          } else {
            s.tasks.push(task);
          }
        }),
      );
    },

    moveTaskToStatus: (taskId: string, status: TaskStatus) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, parentArray, index] = res;

          // Remove from old position
          parentArray.splice(index, 1);

          // Update status
          task.status = status;

          // Move to end of root list (Kanban behavior)
          s.tasks.push(task);
          task.parentId = undefined;
        }),
      );
    },

    moveTaskToStatusAtIndex: (
      taskId: string,
      status: TaskStatus,
      index: number,
    ) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, parentArray, currentIndex] = res;

          parentArray.splice(currentIndex, 1);

          setSubtreeStatus(task, status);
          task.parentId = undefined;

          const root = s.tasks;
          const statusIndices: number[] = [];
          for (let i = 0; i < root.length; i++) {
            if (root[i].status === status) statusIndices.push(i);
          }

          const safeIndex = Math.max(0, index);
          let insertAt = root.length;
          if (statusIndices.length > 0) {
            if (safeIndex >= statusIndices.length) {
              insertAt = statusIndices[statusIndices.length - 1] + 1;
            } else {
              insertAt = statusIndices[safeIndex];
            }
          }

          root.splice(insertAt, 0, task);
        }),
      );
    },

    reorderTask: (taskId: string, newIndex: number) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, parentArray, currentIndex] = res;

          // Remove from old index
          parentArray.splice(currentIndex, 1);

          // Insert at new index
          // Ensure index is within bounds
          const targetIndex = Math.max(
            0,
            Math.min(newIndex, parentArray.length),
          );
          parentArray.splice(targetIndex, 0, task);
        }),
      );
    },

    moveTaskBefore: (taskId: string, targetId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          const targetRes = findTask(s.tasks, targetId);

          if (!res || !targetRes) return;

          const [task, parentArray, currentIndex] = res;
          const [targetTask, targetParentArray, targetIndex] = targetRes;

          if (parentArray !== targetParentArray) {
            parentArray.splice(currentIndex, 1);

            task.parentId = targetTask.parentId;
            if (task.status !== targetTask.status) {
              setSubtreeStatus(task, targetTask.status);
            }
            targetParentArray.splice(targetIndex, 0, task);
          } else {
            if (task.status !== targetTask.status) {
              setSubtreeStatus(task, targetTask.status);
            }
            if (task.parentId !== targetTask.parentId) {
              task.parentId = targetTask.parentId;
            }
            parentArray.splice(currentIndex, 1);
            parentArray.splice(targetIndex, 0, task);
          }
        }),
      );
    },

    toggleCollapse: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (res) {
            res[0].isCollapsed = !res[0].isCollapsed;
          }
        }),
      );
    },

    toggleDone: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task] = res;
          if (task.subtasks.length > 0) return;
          task.isDone = !task.isDone;
          task.completedAt = task.isDone ? new Date().toISOString() : undefined;
        }),
      );
    },

    clearSubtreeIsDone: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          walkSubtree(res[0], (t) => {
            if (t.isDone) {
              t.isDone = false;
              t.completedAt = undefined;
            }
          });
        }),
      );
    },

    markSubtreeLeavesDone: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const completedAt = new Date().toISOString();
          walkSubtree(res[0], (t) => {
            if (t.subtasks.length > 0) return;
            if (!t.isDone) {
              t.isDone = true;
              t.completedAt = completedAt;
            }
          });
        }),
      );
    },

    archiveTask: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (res) {
            res[0].isArchived = true;
          }
        }),
      );
    },

    unarchiveTask: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const unarchiveTree = (task: Task) => {
            task.isArchived = false;
            for (const sub of task.subtasks) {
              unarchiveTree(sub);
            }
          };
          unarchiveTree(res[0]);
        }),
      );
    },

    archiveDoneTasks: () => {
      setState(
        produce((s) => {
          archiveDoneRecursive(s.tasks);
        }),
      );
    },

    archiveDoneInTree: (taskId: string) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          archiveDoneRecursive([res[0]]);
        }),
      );
    },

    moveTaskToRootAtIndex: (taskId: string, index: number) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, oldParentArray, currentIndex] = res;

          oldParentArray.splice(currentIndex, 1);
          task.parentId = undefined;

          const safeIndex = Math.max(0, Math.min(index, s.tasks.length));
          s.tasks.splice(safeIndex, 0, task);
        }),
      );
    },

    moveTaskToRootAtIndexWithStatus: (
      taskId: string,
      status: TaskStatus,
      index: number,
    ) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, oldParentArray, currentIndex] = res;

          oldParentArray.splice(currentIndex, 1);
          task.parentId = undefined;
          setSubtreeStatus(task, status);

          const safeIndex = Math.max(0, Math.min(index, s.tasks.length));
          s.tasks.splice(safeIndex, 0, task);
        }),
      );
    },

    moveSubtaskToIndex: (taskId: string, parentId: string, index: number) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task, oldParentArray, currentIndex] = res;

          oldParentArray.splice(currentIndex, 1);
          task.parentId = parentId;

          const parentRes = findTask(s.tasks, parentId);
          if (parentRes) {
            const [parent] = parentRes;
            parent.isCollapsed = false;
            setSubtreeStatus(task, parent.status);
            const safeIndex = Math.max(
              0,
              Math.min(index, parent.subtasks.length),
            );
            parent.subtasks.splice(safeIndex, 0, task);
          } else {
            s.tasks.push(task);
            task.parentId = undefined;
          }
        }),
      );
    },

    addScheduledSlot: (taskId: string, newTime: Date, duration?: number) => {
      setState(
        produce((s) => {
          const res = findTask(s.tasks, taskId);
          if (!res) return;
          const [task] = res;

          const slot: ScheduledTime = {
            id: crypto.randomUUID(),
            start: newTime,
            duration: duration ?? DEFAULT_SLOT_DURATION,
          };
          task.scheduledTimes.push(slot);

          const dayStr = formatLocalDate(newTime);
          const daySlots: ResolvableSlotRef[] = [];
          collectSlotsForDay(s.tasks, s.calendarDraftSlots, dayStr, daySlots);
          resolveDaySchedule(daySlots, newTime, slot.id);
        }),
      );
    },

    updateScheduledSlotTime: (slotId: string, newTime: Date) => {
      setState(
        produce((s) => {
          const res = findSlot(s.tasks, slotId);
          if (!res) return;
          const { slot } = res;

          slot.start = newTime;

          const dayStr = formatLocalDate(newTime);
          const daySlots: ResolvableSlotRef[] = [];
          collectSlotsForDay(s.tasks, s.calendarDraftSlots, dayStr, daySlots);
          resolveDaySchedule(daySlots, newTime, slotId);
        }),
      );
    },

    updateScheduledSlotDuration: (
      slotId: string,
      duration: number,
      startMinutes?: number,
    ) => {
      setState(
        produce((s) => {
          const res = findSlot(s.tasks, slotId);
          if (!res) return;
          const { slot } = res;

          slot.duration = duration;
          let baseDate = toDate(slot.start);
          if (!baseDate) return;
          if (startMinutes != null) {
            slot.start = buildDateAtMinutes(baseDate, startMinutes);
            baseDate = toDate(slot.start);
            if (!baseDate) return;
          }
          const dayStr = getLocalDateId(baseDate);
          if (!dayStr) return;

          const daySlots: ResolvableSlotRef[] = [];
          collectSlotsForDay(s.tasks, s.calendarDraftSlots, dayStr, daySlots);
          resolveDaySchedule(daySlots, baseDate, slotId);
        }),
      );
    },

    removeScheduledSlot: (slotId: string) => {
      setState(
        produce((s) => {
          const res = findSlot(s.tasks, slotId);
          if (!res) return;
          const { task } = res;
          const index = task.scheduledTimes.findIndex(
            (slot) => slot.id === slotId,
          );
          if (index >= 0) {
            task.scheduledTimes.splice(index, 1);
          }
        }),
      );
    },

    addCalendarDraftSlot: (
      start: Date,
      duration = DEFAULT_SLOT_DURATION,
      title = DEFAULT_CALENDAR_DRAFT_TITLE,
    ) => {
      const normalizedTitle = title.trim()
        ? title.trim()
        : DEFAULT_CALENDAR_DRAFT_TITLE;
      const safeDuration = duration > 0 ? duration : DEFAULT_SLOT_DURATION;
      const slotId = crypto.randomUUID();

      setState(
        produce((s) => {
          const slot: CalendarDraftSlot = {
            id: slotId,
            title: normalizedTitle,
            start,
            duration: safeDuration,
          };
          s.calendarDraftSlots.push(slot);

          const dayStr = formatLocalDate(start);
          const daySlots: ResolvableSlotRef[] = [];
          collectSlotsForDay(s.tasks, s.calendarDraftSlots, dayStr, daySlots);
          resolveDaySchedule(daySlots, start, slot.id);
        }),
      );

      return slotId;
    },

    updateCalendarDraftSlotTime: (slotId: string, newTime: Date) => {
      setState(
        produce((s) => {
          const slot = findCalendarDraftSlot(s.calendarDraftSlots, slotId);
          if (!slot) return;
          slot.start = newTime;

          const dayStr = formatLocalDate(newTime);
          const daySlots: ResolvableSlotRef[] = [];
          collectSlotsForDay(s.tasks, s.calendarDraftSlots, dayStr, daySlots);
          resolveDaySchedule(daySlots, newTime, slotId);
        }),
      );
    },

    updateCalendarDraftSlotDuration: (
      slotId: string,
      duration: number,
      startMinutes?: number,
    ) => {
      setState(
        produce((s) => {
          const slot = findCalendarDraftSlot(s.calendarDraftSlots, slotId);
          if (!slot) return;

          slot.duration = duration > 0 ? duration : DEFAULT_SLOT_DURATION;

          let baseDate = toDate(slot.start);
          if (!baseDate) return;
          if (startMinutes != null) {
            slot.start = buildDateAtMinutes(baseDate, startMinutes);
            baseDate = toDate(slot.start);
            if (!baseDate) return;
          }
          const dayStr = getLocalDateId(baseDate);
          if (!dayStr) return;

          const daySlots: ResolvableSlotRef[] = [];
          collectSlotsForDay(s.tasks, s.calendarDraftSlots, dayStr, daySlots);
          resolveDaySchedule(daySlots, baseDate, slotId);
        }),
      );
    },

    updateCalendarDraftSlotTitle: (slotId: string, title: string) => {
      setState(
        produce((s) => {
          const slot = findCalendarDraftSlot(s.calendarDraftSlots, slotId);
          if (!slot) return;
          slot.title = title.trim();
        }),
      );
    },

    getDraftSlotContext: (slotId: string) => {
      const slot = state.calendarDraftSlots.find((s) => s.id === slotId);
      return slot ?? null;
    },

    updateCalendarDraftSlot: (
      slotId: string,
      updates: Partial<
        Pick<
          CalendarDraftSlot,
          | "title"
          | "category"
          | "description"
          | "dueDate"
          | "importance"
          | "urgency"
        >
      >,
    ) => {
      setState(
        produce((s) => {
          const slot = findCalendarDraftSlot(s.calendarDraftSlots, slotId);
          if (!slot) return;
          if (updates.title !== undefined) {
            slot.title = updates.title.trim();
          }
          if (updates.category !== undefined) {
            slot.category = updates.category;
          }
          if (updates.description !== undefined) {
            slot.description = updates.description;
          }
          if (updates.dueDate !== undefined) {
            slot.dueDate = updates.dueDate;
          }
          if (updates.importance !== undefined) {
            slot.importance = updates.importance;
          }
          if (updates.urgency !== undefined) {
            slot.urgency = updates.urgency;
          }
        }),
      );
    },

    removeCalendarDraftSlot: (slotId: string) => {
      setState(
        produce((s) => {
          const index = s.calendarDraftSlots.findIndex(
            (slot) => slot.id === slotId,
          );
          if (index >= 0) {
            s.calendarDraftSlots.splice(index, 1);
          }
        }),
      );
    },

    convertDraftSlotToTask: (slotId: string): string | null => {
      const draft = state.calendarDraftSlots.find((s) => s.id === slotId);
      if (!draft) return null;

      const taskId = crypto.randomUUID();
      setState(
        produce((s) => {
          const draftIndex = s.calendarDraftSlots.findIndex(
            (slot) => slot.id === slotId,
          );
          if (draftIndex < 0) return;
          const draftSlot = s.calendarDraftSlots[draftIndex];

          const newTask: Task = {
            id: taskId,
            title: draftSlot.title,
            status: "inbox",
            description: draftSlot.description ?? "",
            dueDate: draftSlot.dueDate ?? null,
            category: draftSlot.category ?? null,
            importance: draftSlot.importance ?? "none",
            urgency: draftSlot.urgency ?? "none",
            subtasks: [],
            scheduledTimes: [
              {
                id: crypto.randomUUID(),
                start: draftSlot.start,
                duration: draftSlot.duration,
              },
            ],
          };
          s.tasks.push(newTask);
          s.calendarDraftSlots.splice(draftIndex, 1);
        }),
      );

      return taskId;
    },

    addRoutineItem: (
      input: Omit<RoutineItem, "id"> & { id?: string },
    ): string => {
      const id = input.id ?? crypto.randomUUID();
      const repeatDays = (input.repeatDays ?? []).filter(
        (day) => day !== input.homeDay,
      );
      const item: RoutineItem = {
        id,
        title: input.title,
        duration: input.duration > 0 ? input.duration : DEFAULT_SLOT_DURATION,
        homeDay: input.homeDay,
        startMinutes: input.startMinutes,
        repeatDays,
        category: input.category ?? null,
        description: input.description ?? "",
        dueDate: input.dueDate ?? null,
        importance: input.importance ?? "none",
        urgency: input.urgency ?? "none",
      };
      setState(
        produce((s) => {
          s.weeklyTemplate.push(item);
        }),
      );
      return id;
    },

    updateRoutineItem: (id: string, updates: Partial<Omit<RoutineItem, "id">>) => {
      setState(
        produce((s) => {
          const item = s.weeklyTemplate.find((entry) => entry.id === id);
          if (!item) return;
          if (updates.title !== undefined) item.title = updates.title;
          if (updates.duration !== undefined && updates.duration > 0) {
            item.duration = updates.duration;
          }
          if (updates.homeDay !== undefined) item.homeDay = updates.homeDay;
          if (updates.startMinutes !== undefined) {
            item.startMinutes = updates.startMinutes;
          }
          if (updates.repeatDays !== undefined) {
            item.repeatDays = updates.repeatDays.filter(
              (day) => day !== item.homeDay,
            );
          }
          if (updates.category !== undefined) item.category = updates.category;
          if (updates.description !== undefined) {
            item.description = updates.description;
          }
          if (updates.dueDate !== undefined) item.dueDate = updates.dueDate;
          if (updates.importance !== undefined) {
            item.importance = updates.importance;
          }
          if (updates.urgency !== undefined) item.urgency = updates.urgency;
        }),
      );
    },

    deleteRoutineItem: (id: string) => {
      setState(
        produce((s) => {
          const index = s.weeklyTemplate.findIndex((entry) => entry.id === id);
          if (index >= 0) {
            s.weeklyTemplate.splice(index, 1);
          }
        }),
      );
    },

    // Detach a ghost (a repeat-day instance of a routine item) into a new
    // standalone home-day item on `ghostDay`, with `edits` applied to the
    // clone. The original keeps its identity but loses `ghostDay` from its
    // repeatDays. Returns the clone's id, or null if the operation cannot
    // run (source missing, or `ghostDay` is not actually a ghost — i.e. it
    // is the home day or not in repeatDays).
    detachRoutineGhost: (
      sourceId: string,
      ghostDay: Weekday,
      edits: Partial<Omit<RoutineItem, "id" | "homeDay" | "repeatDays">>,
    ): string | null => {
      const source = state.weeklyTemplate.find((item) => item.id === sourceId);
      if (!source) return null;
      if (ghostDay === source.homeDay) return null;
      if (!source.repeatDays.includes(ghostDay)) return null;

      const cloneId = crypto.randomUUID();
      setState(
        produce((s) => {
          const original = s.weeklyTemplate.find((item) => item.id === sourceId);
          if (!original) return;
          original.repeatDays = original.repeatDays.filter(
            (day) => day !== ghostDay,
          );

          const clone: RoutineItem = {
            id: cloneId,
            title: edits.title ?? original.title,
            duration:
              edits.duration !== undefined && edits.duration > 0
                ? edits.duration
                : original.duration,
            homeDay: ghostDay,
            startMinutes:
              edits.startMinutes !== undefined
                ? edits.startMinutes
                : original.startMinutes,
            repeatDays: [],
            category:
              edits.category !== undefined ? edits.category : original.category,
            description:
              edits.description !== undefined
                ? edits.description
                : original.description,
            dueDate:
              edits.dueDate !== undefined ? edits.dueDate : original.dueDate,
            importance:
              edits.importance !== undefined
                ? edits.importance
                : original.importance,
            urgency:
              edits.urgency !== undefined ? edits.urgency : original.urgency,
          };
          s.weeklyTemplate.push(clone);
        }),
      );

      return cloneId;
    },

    startDay: (
      now: Date,
      externalEvents: { start: Date | string; duration: number }[] = [],
    ) => {
      setState(
        produce((s) => {
          const todayId = formatLocalDate(now);

          // Wipe any previously-stamped slots on today first so they do not
          // conflict with the fresh stamping pass; manually drawn slots have no
          // templateItemId and are kept.
          for (let i = s.calendarDraftSlots.length - 1; i >= 0; i -= 1) {
            const slot = s.calendarDraftSlots[i];
            if (
              slot.templateItemId &&
              getLocalDateId(slot.start) === todayId
            ) {
              s.calendarDraftSlots.splice(i, 1);
            }
          }

          const conflicts: StampingConflict[] = [];

          for (const slot of s.calendarDraftSlots) {
            if (getLocalDateId(slot.start) !== todayId) continue;
            const time = toDate(slot.start);
            if (!time) continue;
            conflicts.push({
              startMinutes: getMinutesInDay(time),
              duration: slot.duration,
            });
          }

          const collectTaskScheduledTimes = (tasks: Task[]) => {
            for (const task of tasks) {
              for (const slot of task.scheduledTimes) {
                if (getLocalDateId(slot.start) !== todayId) continue;
                const time = toDate(slot.start);
                if (!time) continue;
                conflicts.push({
                  startMinutes: getMinutesInDay(time),
                  duration: slot.duration,
                });
              }
              if (task.subtasks.length > 0) {
                collectTaskScheduledTimes(task.subtasks);
              }
            }
          };
          collectTaskScheduledTimes(s.tasks);

          for (const event of externalEvents) {
            const time = toDate(event.start);
            if (!time) continue;
            if (getLocalDateId(time) !== todayId) continue;
            conflicts.push({
              startMinutes: getMinutesInDay(time),
              duration: event.duration,
            });
          }

          const stamps = stampRoutine({
            items: s.weeklyTemplate.map((item) => ({
              id: item.id,
              startMinutes: item.startMinutes,
              duration: item.duration,
              homeDay: item.homeDay,
              repeatDays: item.repeatDays,
            })),
            todayWeekday: now.getDay(),
            nowFloorMinutes: ceilToFifteen(getMinutesInDay(now)),
            conflicts,
          });

          for (const stamp of stamps) {
            const sourceItem = s.weeklyTemplate.find(
              (entry) => entry.id === stamp.templateItemId,
            );
            if (!sourceItem) continue;
            s.calendarDraftSlots.push({
              id: crypto.randomUUID(),
              title: sourceItem.title.trim()
                ? sourceItem.title.trim()
                : DEFAULT_CALENDAR_DRAFT_TITLE,
              start: buildDateAtMinutes(now, stamp.startMinutes),
              duration: stamp.duration,
              category: sourceItem.category ?? null,
              description: sourceItem.description ?? "",
              dueDate: sourceItem.dueDate ?? null,
              importance: sourceItem.importance ?? "none",
              urgency: sourceItem.urgency ?? "none",
              templateItemId: sourceItem.id,
            });
          }
        }),
      );
    },
  };

  return [state, actions] as const;
}

// Keep the original export for testing if needed, or update tests
export const createTaskStore = createTaskStoreModel;

type TaskStore = ReturnType<typeof createTaskStoreModel>;

const TaskContext = createContext<TaskStore>();

export const TaskProvider: ParentComponent = (props) => {
  const store = createTaskStoreModel();
  return (
    <TaskContext.Provider value={store}>{props.children}</TaskContext.Provider>
  );
};

export const useTaskStore = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskStore must be used within a TaskProvider");
  }
  return context;
};
