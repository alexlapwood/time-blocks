import {
  type Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { cva } from "class-variance-authority";
import {
  type Task,
  useTaskStore,
  getEffectiveCategory,
} from "../store/taskStore";
import { TaskCard } from "./TaskCard";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { draggable, droppable, type DropInfo } from "../directives/dnd";
import {
  activeDragData,
  activeDragId,
  dragOver,
  dragSource,
  dropAnimation,
  isDragging,
} from "../store/dragStore";
import {
  buildFlatListWithPreview,
  computeFlatDropIndex,
  mapFilteredIndex,
  removeFlatSubtree,
  resolveDropParent,
  DRAG_PREVIEW_ID,
  type FlatTask,
} from "../utils/dragPreview";
import { animateListDrop } from "../utils/dropAnimation";

void draggable;
void droppable;

const modalBackdropClasses = cva(
  "fixed inset-0 z-[80] flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_75%,transparent)] p-6 backdrop-blur-[10px]",
);

const modalCardClasses = cva(
  "flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--outline) bg-(--surface) shadow-(--shadow-pop)",
);

const modalHeaderClasses = cva(
  "flex items-start justify-between gap-4 border-b border-(--outline-soft) px-[1.6rem] pb-4 pt-6",
);

const modalTitleClasses = cva("m-0 font-display text-[1.4rem] text-(--ink)");

const modalCloseButtonClasses = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[0.9rem] py-[0.4rem] font-body text-[0.82rem] font-medium leading-none tracking-[0.02em] text-(--ink-muted) transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--brand)_30%,var(--outline))] hover:text-(--ink) hover:shadow-[0_2px_6px_color-mix(in_srgb,var(--brand)_12%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
);

const INDENT_PX = 24;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date);
  return weekStart.toISOString().split("T")[0];
}

function collectLeafDates(task: Task): Date[] {
  if (task.subtasks.length === 0 || task.isDone) {
    if (task.completedAt) return [new Date(task.completedAt)];
    return [];
  }
  return task.subtasks.flatMap(collectLeafDates);
}

function filterTaskForWeek(task: Task, weekKey: string): Task | null {
  if (task.subtasks.length === 0 || task.isDone) {
    if (task.completedAt && getWeekKey(new Date(task.completedAt)) === weekKey)
      return task;
    return null;
  }

  const filteredSubtasks = task.subtasks
    .map((sub) => filterTaskForWeek(sub, weekKey))
    .filter((t): t is Task => t !== null);

  if (filteredSubtasks.length === 0) return null;
  return { ...task, subtasks: filteredSubtasks };
}

type WeekGroup = {
  weekKey: string;
  label: string;
  tasks: Task[];
};

function collectArchivedTrees(tasks: Task[]): Task[] {
  const result: Task[] = [];
  for (const task of tasks) {
    if (task.isArchived) {
      result.push(task);
    } else if (task.subtasks.length > 0) {
      const archivedChildren = collectArchivedTrees(task.subtasks);
      if (archivedChildren.length > 0) {
        result.push({ ...task, subtasks: archivedChildren });
      }
    }
  }
  return result;
}

function getEffectiveCompletedAt(task: Task): Date | null {
  if (task.completedAt) return new Date(task.completedAt);
  const dates = collectLeafDates(task);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function sortByCompletedAt(tasks: Task[]): Task[] {
  return [...tasks]
    .map((task) => ({
      ...task,
      subtasks:
        task.subtasks.length > 0
          ? sortByCompletedAt(task.subtasks)
          : task.subtasks,
    }))
    .sort((a, b) => {
      const dateA = getEffectiveCompletedAt(a);
      const dateB = getEffectiveCompletedAt(b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });
}

function groupArchivedByWeek(allTasks: Task[]): WeekGroup[] {
  const archivedTasks = collectArchivedTrees(allTasks);
  const weekMap = new Map<string, Task[]>();

  for (const task of archivedTasks) {
    const dates = collectLeafDates(task);
    const weekKeys = new Set(dates.map((d) => getWeekKey(d)));

    if (weekKeys.size === 0) {
      const key = "no-date";
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(task);
      continue;
    }

    for (const weekKey of weekKeys) {
      const filtered = filterTaskForWeek(task, weekKey);
      if (filtered) {
        if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
        weekMap.get(weekKey)!.push(filtered);
      }
    }
  }

  const sorted = Array.from(weekMap.entries()).sort((a, b) => {
    if (a[0] === "no-date") return 1;
    if (b[0] === "no-date") return -1;
    return b[0].localeCompare(a[0]);
  });

  return sorted.map(([weekKey, tasks]) => {
    const sortedTasks = sortByCompletedAt(tasks);
    if (weekKey === "no-date") {
      return { weekKey, label: "Unknown date", tasks: sortedTasks };
    }
    const weekStart = new Date(weekKey + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startOpts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    const endOpts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };

    const label = `${weekStart.toLocaleDateString("en-US", startOpts)} – ${weekEnd.toLocaleDateString("en-US", endOpts)}`;
    return { weekKey, label, tasks: sortedTasks };
  });
}

type FlatArchiveItem = {
  task: Task;
  depth: number;
  isArchived: boolean;
};

function flattenArchiveTasks(
  tasks: Task[],
  expandedIds: Set<string>,
  depth = 0,
): FlatArchiveItem[] {
  const result: FlatArchiveItem[] = [];
  for (const task of tasks) {
    result.push({ task, depth, isArchived: !!task.isArchived });
    if (task.subtasks.length > 0 && expandedIds.has(task.id)) {
      result.push(
        ...flattenArchiveTasks(task.subtasks, expandedIds, depth + 1),
      );
    }
  }
  return result;
}

function findInTree(tasks: Task[], id: string): Task | null {
  for (const t of tasks) {
    if (t.id === id) return t;
    const found = findInTree(t.subtasks, id);
    if (found) return found;
  }
  return null;
}

function computeMidpointDate(before: Date | null, after: Date | null): string {
  if (before && after) {
    return new Date((before.getTime() + after.getTime()) / 2).toISOString();
  }
  if (before) {
    return new Date(before.getTime() + 60000).toISOString();
  }
  if (after) {
    return new Date(after.getTime() - 60000).toISOString();
  }
  return new Date().toISOString();
}

export const ArchiveModal: Component<{
  open: boolean;
  onClose: () => void;
  onOpenTask?: (taskId: string) => void;
}> = (props) => {
  const [state, actions] = useTaskStore();
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>(null);
  const [expandedIds, setExpandedIds] = createSignal(new Set<string>());

  const toggleCollapse = (taskId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const weekGroups = createMemo(() => groupArchivedByWeek(state.tasks));
  const hasArchived = createMemo(() => weekGroups().length > 0);

  const activeTask = () => {
    const data = activeDragData();
    if (data && typeof data === "object" && "scheduledTimes" in data) {
      return data as Task;
    }
    return null;
  };

  const handleContextMenu = (event: MouseEvent, taskId: string) => {
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          label: "Edit",
          onClick: () => props.onOpenTask?.(taskId),
        },
        {
          label: "Unarchive",
          onClick: () => actions.unarchiveTask(taskId),
        },
        {
          label: "Delete",
          danger: true,
          onClick: () => actions.deleteTask(taskId),
        },
      ],
    });
  };

  const createDropHandler =
    (listId: string) => (draggedId: string, info: DropInfo) => {
      const over = info.over;
      if (!over || over.kind !== "list" || over.listId !== listId) return;

      const source = dragSource();
      if (source?.kind === "calendar") return;

      const weekKey = listId.slice("archive::".length);
      const group = weekGroups().find((g) => g.weekKey === weekKey);
      if (!group) return;

      const depth = over.depth ?? 0;
      const flatItems = flattenArchiveTasks(group.tasks, expandedIds());
      const flat: FlatTask[] = flatItems.map((item) => ({
        task: item.task,
        depth: item.depth,
      }));

      const { filtered } = removeFlatSubtree(flat, draggedId);
      const insertPos = computeFlatDropIndex(filtered, over);
      const { parentId, childIndex } = resolveDropParent(
        filtered,
        insertPos,
        depth,
      );

      let sortedSiblings: Task[];
      if (parentId) {
        const parent = findInTree(group.tasks, parentId);
        sortedSiblings = parent
          ? parent.subtasks.filter((t) => t.id !== draggedId)
          : [];
      } else {
        sortedSiblings = group.tasks.filter((t) => t.id !== draggedId);
      }

      const beforeTask = childIndex > 0 ? sortedSiblings[childIndex - 1] : null;
      const afterTask =
        childIndex < sortedSiblings.length ? sortedSiblings[childIndex] : null;
      const beforeDate = beforeTask
        ? getEffectiveCompletedAt(beforeTask)
        : null;
      const afterDate = afterTask ? getEffectiveCompletedAt(afterTask) : null;
      const midpointDate = computeMidpointDate(beforeDate, afterDate);

      const isVisibleInWeek = (task: Task): boolean => {
        if (
          task.completedAt &&
          getWeekKey(new Date(task.completedAt)) === weekKey
        )
          return true;
        return task.subtasks.some((s) => isVisibleInWeek(s));
      };

      animateListDrop(() => {
        if (parentId) {
          const parentCtx = actions.getTaskContext(parentId);
          if (!parentCtx) return;
          const realSiblings = parentCtx.task.subtasks.filter(
            (t) => t.id !== draggedId,
          );
          const actualIndex = mapFilteredIndex(
            realSiblings,
            childIndex,
            isVisibleInWeek,
          );
          actions.moveSubtaskToIndex(draggedId, parentId, actualIndex);
        } else {
          const ctx = actions.getTaskContext(draggedId);
          if (ctx?.task.parentId) {
            actions.moveTaskToRootAtIndex(draggedId, state.tasks.length);
          }
        }
        actions.updateTask(draggedId, { completedAt: midpointDate });
      });
    };

  createEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.open}>
      <div
        class={modalBackdropClasses()}
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class={modalCardClasses()} onClick={(e) => e.stopPropagation()}>
          <div class={modalHeaderClasses()}>
            <div>
              <h2 class={modalTitleClasses()}>Archived Tasks</h2>
            </div>
            <button
              type="button"
              class={modalCloseButtonClasses()}
              onClick={props.onClose}
            >
              Close
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-[1.6rem] pb-[1.4rem] pt-[1.2rem]">
            <Show
              when={hasArchived()}
              fallback={
                <div class="py-8 text-center text-[0.9rem] text-(--ink-soft)">
                  No archived tasks
                </div>
              }
            >
              <div class="flex flex-col gap-6">
                <For each={weekGroups()}>
                  {(group) => {
                    const listId = `archive::${group.weekKey}`;
                    const flatItems = createMemo(() =>
                      flattenArchiveTasks(group.tasks, expandedIds()),
                    );
                    const flatTasksForPreview = createMemo((): FlatTask[] =>
                      flatItems().map((item) => ({
                        task: item.task,
                        depth: item.depth,
                      })),
                    );
                    const archivedIdSet = createMemo(() => {
                      const set = new Set<string>();
                      for (const item of flatItems()) {
                        if (item.isArchived) set.add(item.task.id);
                      }
                      return set;
                    });
                    const previewTasks = createMemo(() =>
                      buildFlatListWithPreview(
                        flatTasksForPreview(),
                        activeDragId(),
                        activeTask(),
                        dragOver(),
                        listId,
                        isDragging(),
                        dragSource(),
                      ),
                    );

                    return (
                      <div>
                        <h3 class="mb-3 text-[0.8rem] font-semibold uppercase tracking-widest text-(--ink-muted)">
                          {group.label}
                        </h3>
                        <div
                          use:droppable={{
                            id: listId,
                            kind: "list",
                            onDrop: createDropHandler(listId),
                          }}
                          class="flex flex-col gap-2"
                        >
                          <For each={previewTasks()}>
                            {(item) => {
                              const isGhost = () =>
                                item.task.id === DRAG_PREVIEW_ID;
                              const isDropGhost = () =>
                                dropAnimation()?.task.id === item.task.id;
                              const isArchived = () =>
                                archivedIdSet().has(item.task.id);

                              if (isGhost()) {
                                return (
                                  <div
                                    data-preview="true"
                                    data-drop-kind="item"
                                    data-drop-list={listId}
                                    data-task-depth={item.depth}
                                    style={{
                                      "padding-left": `${item.depth * INDENT_PX}px`,
                                    }}
                                    class="pointer-events-none"
                                  >
                                    <TaskCard
                                      task={item.task}
                                      variant="ghost"
                                    />
                                  </div>
                                );
                              }

                              if (!isArchived()) {
                                return (
                                  <div
                                    data-drop-kind="item"
                                    data-drop-id={item.task.id}
                                    data-drop-list={listId}
                                    data-task-depth={item.depth}
                                    style={{
                                      "padding-left": `${item.depth * INDENT_PX}px`,
                                    }}
                                  >
                                    <TaskCard
                                      task={{
                                        ...item.task,
                                        isCollapsed:
                                          item.task.subtasks.length > 0 &&
                                          !expandedIds().has(item.task.id),
                                      }}
                                      variant="normal"
                                      isParentHeader={true}
                                      onOpen={props.onOpenTask}
                                      onToggleCollapse={toggleCollapse}
                                      onContextMenu={handleContextMenu}
                                      showDueDate={false}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div
                                  use:draggable={{
                                    id: item.task.id,
                                    data: {
                                      ...item.task,
                                      category: getEffectiveCategory(
                                        state.tasks,
                                        item.task,
                                      ),
                                    },
                                  }}
                                  data-flip-id={item.task.id}
                                  data-drop-ghost={
                                    isDropGhost() ? "true" : undefined
                                  }
                                  data-drag-source="list"
                                  data-drag-list={listId}
                                  data-drop-kind="item"
                                  data-drop-id={item.task.id}
                                  data-drop-list={listId}
                                  data-task-depth={item.depth}
                                  style={{
                                    "padding-left": `${item.depth * INDENT_PX}px`,
                                  }}
                                  class="transition-opacity"
                                >
                                  <TaskCard
                                    task={{
                                      ...item.task,
                                      isCollapsed:
                                        item.task.subtasks.length > 0 &&
                                        !expandedIds().has(item.task.id),
                                    }}
                                    variant={isDropGhost() ? "ghost" : "normal"}
                                    onOpen={props.onOpenTask}
                                    onToggleCollapse={toggleCollapse}
                                    onContextMenu={handleContextMenu}
                                    showDueDate={false}
                                  />
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>
        <ContextMenu
          state={contextMenu()}
          onClose={() => setContextMenu(null)}
        />
      </div>
    </Show>
  );
};
