import { type Component, For, createMemo } from "solid-js";
import { cva } from "class-variance-authority";
import { useTaskStore, type Task, type TaskStatus } from "../store/taskStore";
import { TaskCard } from "./TaskCard";
import { componentThemeClasses } from "../themes/index";
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
  flattenTasks,
  removeFlatSubtree,
  resolveDropParent,
  DRAG_PREVIEW_ID,
} from "../utils/dragPreview";
import { animateListDrop } from "../utils/dropAnimation";

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

type BoardStatus = Extract<TaskStatus, "todo" | "in_progress" | "done">;

const boardColumnClasses = cva(
  "relative flex h-fit min-h-0 max-h-full w-full min-w-0 flex-col overflow-hidden rounded-[16px] border-2 shadow-[var(--shadow-soft)] transition-colors",
  {
    variants: {
      status: {
        todo: "border-[var(--column-outline)] bg-[var(--surface-2)]",
        in_progress: "border-[var(--column-outline)] bg-[var(--surface-2)]",
        done: "border-[var(--column-outline)] bg-[var(--surface-2)]",
      },
    },
  },
);

const boardColumnHeaderClasses = cva(
  "relative z-[2] rounded-t-[14px] border-b border-[var(--outline-faint)] px-4 pb-3 pt-4",
  {
    variants: {
      status: {
        todo: "bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)]",
        in_progress: "bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)]",
        done: "bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)]",
      },
    },
  },
);

const boardColumnBodyClasses = cva(
  "relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:auto] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink-muted)_58%,transparent)_transparent] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--ink-muted)_58%,transparent)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--ink-muted)_74%,transparent)]",
  {
    variants: {
      empty: {
        true: "p-0",
        false: "px-4 pb-[0.6rem] pt-[0.6rem]",
      },
    },
    defaultVariants: {
      empty: false,
    },
  },
);

const boardColumnFooterClasses = cva(
  "relative z-[2] rounded-b-[14px] border-t border-[var(--outline-faint)] px-4 pb-[0.9rem] pt-[0.65rem]",
  {
    variants: {
      status: {
        todo: "bg-[color-mix(in_srgb,var(--surface-2)_65%,transparent)]",
        in_progress: "bg-[color-mix(in_srgb,var(--surface-2)_65%,transparent)]",
        done: "bg-[color-mix(in_srgb,var(--surface-2)_65%,transparent)]",
      },
    },
  },
);

const addCardButtonClasses = [
  "w-full cursor-pointer rounded-full border-2 border-[color-mix(in_srgb,var(--brand)_35%,var(--outline))]",
  "bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface-solid))] px-4 py-[0.55rem]",
  "text-center font-body text-[0.88rem] font-bold tracking-[0.02em] text-[var(--ink)]",
  "shadow-none transition-[transform,box-shadow,border-color,background] duration-150 ease-out",
  "hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--brand)_55%,var(--outline))]",
  "hover:bg-[color-mix(in_srgb,var(--brand)_14%,var(--surface-solid))]",
  "hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--brand)_18%,transparent)]",
  "active:translate-y-0",
  "focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)]",
  "focus-visible:outline-offset-[var(--focus-ring-width)]",
  componentThemeClasses.board.addCard,
].join(" ");

const INDENT_PX = 24;

const Column: Component<{
  status: BoardStatus;
  tasks: Task[];
  onOpenTask?: (taskId: string, source?: "add-card") => void;
}> = (props) => {
  const [state, actions] = useTaskStore();
  const columnTitle = () => props.status.replace("_", " ");

  const flatTasks = createMemo(() => flattenTasks(props.tasks));

  const activeTask = () => {
    const data = activeDragData();
    if (data && typeof data === "object" && "scheduledTimes" in data) {
      return data as Task;
    }
    return null;
  };

  const previewTasks = createMemo(() =>
    buildFlatListWithPreview(
      flatTasks(),
      activeDragId(),
      activeTask(),
      dragOver(),
      props.status,
      isDragging(),
      dragSource(),
    ),
  );

  const handleDrop = (draggedId: string, info: DropInfo) => {
    const over = info.over;
    if (!over || over.kind !== "list" || over.listId !== props.status) return;

    const source = dragSource();
    if (source?.kind === "calendar") return;

    const depth = over.depth ?? 0;
    const flat = flatTasks();
    const { filtered } = removeFlatSubtree(flat, draggedId);
    const insertPos = computeFlatDropIndex(filtered, over);
    const { parentId, childIndex } = resolveDropParent(
      filtered,
      insertPos,
      depth,
    );

    animateListDrop(() => {
      if (parentId) {
        actions.moveSubtaskToIndex(draggedId, parentId, childIndex);
      } else {
        actions.moveTaskToStatusAtIndex(draggedId, props.status, childIndex);
      }
    });
  };

  const handleAddCard = () => {
    const existingIds = new Set(state.tasks.map((task) => task.id));
    actions.addTask("New task");

    const createdTask = state.tasks.find((task) => !existingIds.has(task.id));
    if (!createdTask) return;

    actions.moveTaskToStatusAtIndex(
      createdTask.id,
      props.status,
      props.tasks.length,
    );
    props.onOpenTask?.(createdTask.id, "add-card");
  };

  const isEmpty = () => previewTasks().length === 0;

  return (
    <div data-status={props.status} class="min-h-0 min-w-0">
      <div
        use:droppable={{ id: props.status, kind: "list", onDrop: handleDrop }}
        data-status={props.status}
        class={boardColumnClasses({ status: props.status })}
      >
        <div class={boardColumnHeaderClasses({ status: props.status })}>
          <h3 class="m-0 font-display text-[0.85rem] leading-none tracking-[0.14em] text-(--ink-muted) uppercase">
            {columnTitle()}
          </h3>
        </div>
        <div class={boardColumnBodyClasses({ empty: isEmpty() })}>
          <div class="relative min-w-0 **:data-[task-card=true]:mx-auto **:data-[task-card=true]:w-full">
            <For each={previewTasks()}>
              {(item) => {
                const isGhost = () => item.task.id === DRAG_PREVIEW_ID;
                const isDropGhost = () =>
                  dropAnimation()?.task.id === item.task.id;

                if (isGhost()) {
                  return (
                    <div
                      data-preview="true"
                      data-drop-kind="item"
                      data-drop-list={props.status}
                      data-task-depth={item.depth}
                      style={{ "padding-left": `${item.depth * INDENT_PX}px` }}
                      class="mb-2 last:mb-0 pointer-events-none"
                    >
                      <TaskCard task={item.task} variant="ghost" />
                    </div>
                  );
                }

                return (
                  <div
                    use:draggable={{
                      id: item.task.id,
                      data: item.task,
                    }}
                    data-flip-id={item.task.id}
                    data-drop-ghost={
                      isDropGhost() ? "true" : undefined
                    }
                    data-drag-source="list"
                    data-drag-list={props.status}
                    data-drop-kind="item"
                    data-drop-id={item.task.id}
                    data-drop-list={props.status}
                    data-task-depth={item.depth}
                    style={{
                      "padding-left": `${item.depth * INDENT_PX}px`,
                    }}
                    class="mb-2 last:mb-0 transition-opacity"
                  >
                    <TaskCard
                      task={item.task}
                      variant={isDropGhost() ? "ghost" : "normal"}
                      onOpen={props.onOpenTask}
                      onToggleCollapse={(id) =>
                        actions.toggleCollapse(id)
                      }
                      showDueDate={true}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        </div>
        <div class={boardColumnFooterClasses({ status: props.status })}>
          <button
            type="button"
            class={addCardButtonClasses}
            onClick={handleAddCard}
            aria-label={`Add a task to ${columnTitle()}`}
          >
            Add a task
          </button>
        </div>
      </div>
    </div>
  );
};

export const Board: Component<{
  onOpenTask?: (taskId: string, source?: "add-card") => void;
}> = (props) => {
  const [state] = useTaskStore();

  const columns: BoardStatus[] = ["todo", "in_progress", "done"];

  // Filter root tasks by status
  const getTasksByStatus = (status: BoardStatus) => {
    return state.tasks.filter((t) => t.status === status);
  };

  return (
    <div
      class="relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--panel-outline) bg-(--surface-2) shadow-[var(--shadow-pop),var(--panel-glow)] transition-colors [backdrop-filter:var(--panel-backdrop-filter,none)]"
      data-drop-kind="list-region"
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 rounded-[inherit] bg-(--panel-highlight)"
      />
      <div class="relative z-1 flex items-center justify-between px-4 pt-4">
        <h2 class="font-display text-[1.2rem] font-bold tracking-[0.02em]">
          Board
        </h2>
      </div>
      <div class="relative z-1 flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div class="grid h-full w-full min-w-0 grid-cols-3 items-stretch gap-4 p-4">
          <For each={columns}>
            {(status) => (
              <Column
                status={status}
                tasks={getTasksByStatus(status)}
                onOpenTask={props.onOpenTask}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
