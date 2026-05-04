import { type Component, For, createMemo, createSignal } from "solid-js";
import {
  getEffectiveCategory,
  isEffectivelyDone,
  type Task,
  type TaskStatus,
  useTaskStore,
} from "../store/taskStore";
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
import { TaskCard } from "./TaskCard";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";

void draggable;
void droppable;

const INDENT_PX = 24;

export type TaskListPanelCardOptions = {
  showDueDate?: boolean;
  onToggleDone?: (taskId: string) => void;
};

export type TaskListPanelProps = {
  listId: string;
  rootStatus: TaskStatus;
  heading: string;
  inputPlaceholder: string;
  contextMenu: {
    addChildLabel: string;
    newChildTitle: string;
  };
  cardOptions?: TaskListPanelCardOptions;
  onOpenTask?: (taskId: string, source?: "add-card") => void;
};

const PANEL_CLASS =
  "relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--panel-outline) bg-(--surface-2) shadow-[var(--shadow-pop),var(--panel-glow)] transition-colors [backdrop-filter:var(--panel-backdrop-filter,none)]";

const HEADER_CLASS = "relative z-1 px-4 pt-4 pb-3";

const HEADING_CLASS =
  "font-display text-[1.2rem] font-semibold tracking-[0.02em]";

const INPUT_WRAPPER_CLASS = "relative z-1 px-4 pb-3";

const INPUT_CLASS =
  "w-full rounded-(--radius-input) border-2 border-(--outline) bg-(--text-input-bg) px-[0.9rem] py-[0.65rem] font-body font-medium shadow-(--shadow-tile) transition-[transform,box-shadow,border-color] [transition-duration:var(--speed-base)] focus-visible:-translate-y-px focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]";

const SCROLL_WRAPPER_CLASS = "relative z-1 flex-1 min-h-0";

const SCROLL_CLASS =
  "relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-[0.6rem] [scrollbar-gutter:auto] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink-muted)_58%,transparent)_transparent] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--ink-muted)_58%,transparent)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--ink-muted)_74%,transparent)]";

const itemClass = (ghost: boolean) =>
  ghost ? "mb-2 pointer-events-none" : "mb-2 transition-opacity";

export const TaskListPanel: Component<TaskListPanelProps> = (props) => {
  const [state, actions] = useTaskStore();
  const [inputValue, setInputValue] = createSignal("");
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>(null);
  let scrollRef: HTMLDivElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const trimmed = inputValue().trim();
    if (!trimmed) return;
    const id = actions.addTask(trimmed);
    if (props.rootStatus !== "inbox") {
      actions.updateTask(id, { status: props.rootStatus });
    }
    setInputValue("");
  };

  const handleCardContextMenu = (event: MouseEvent, taskId: string) => {
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: "Edit", onClick: () => props.onOpenTask?.(taskId) },
        {
          label: props.contextMenu.addChildLabel,
          onClick: () => {
            const newId = actions.addTask(
              props.contextMenu.newChildTitle,
              taskId,
            );
            props.onOpenTask?.(newId, "add-card");
          },
        },
        {
          label: "Delete",
          danger: true,
          onClick: () => actions.deleteTask(taskId),
        },
      ],
    });
  };

  const rootTasks = () =>
    state.tasks.filter((t) => t.status === props.rootStatus);

  const flatTasks = createMemo(() =>
    flattenTasks(rootTasks()).filter((ft) => !isEffectivelyDone(ft.task)),
  );

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
      props.listId,
      isDragging(),
      dragSource(),
    ),
  );

  const handleDrop = (draggedId: string, info: DropInfo) => {
    const over = info.over;
    if (!over || over.kind !== "list" || over.listId !== props.listId) return;
    if (dragSource()?.kind === "calendar") return;

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
      // Reset isDone on every node in the dragged subtree, not just the
      // root, so a parent dragged out of Done doesn't leave behind isDone
      // descendants that the root-status filter would hide.
      actions.clearSubtreeIsDone(draggedId);
      if (parentId) {
        const parentCtx = actions.getTaskContext(parentId);
        if (!parentCtx) return;
        let visible = 0;
        let actualIndex = parentCtx.task.subtasks.length;
        for (let i = 0; i < parentCtx.task.subtasks.length; i++) {
          if (!isEffectivelyDone(parentCtx.task.subtasks[i])) {
            if (visible === childIndex) {
              actualIndex = i;
              break;
            }
            visible++;
          }
        }
        actions.moveSubtaskToIndex(draggedId, parentId, actualIndex);
      } else {
        let visible = 0;
        let actualIndex = state.tasks.length;
        for (let i = 0; i < state.tasks.length; i++) {
          if (
            state.tasks[i].status === props.rootStatus &&
            !isEffectivelyDone(state.tasks[i])
          ) {
            if (visible === childIndex) {
              actualIndex = i;
              break;
            }
            visible++;
          }
        }
        actions.moveTaskToRootAtIndexWithStatus(
          draggedId,
          props.rootStatus,
          actualIndex,
        );
      }
    });
  };

  return (
    <div
      use:droppable={{ id: props.listId, kind: "list", onDrop: handleDrop }}
      class={PANEL_CLASS}
    >
      <div class="pointer-events-none absolute inset-0 rounded-[inherit] bg-(--panel-highlight)" />
      <div class={HEADER_CLASS}>
        <h2 class={HEADING_CLASS}>{props.heading}</h2>
      </div>
      <div class={INPUT_WRAPPER_CLASS}>
        <input
          type="text"
          placeholder={props.inputPlaceholder}
          class={INPUT_CLASS}
          value={inputValue()}
          onInput={(event) => setInputValue(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div class={SCROLL_WRAPPER_CLASS}>
        <div ref={scrollRef} class={SCROLL_CLASS}>
          <ul class="list-none m-0 p-0 pb-6 pt-1">
            <For each={previewTasks()}>
              {(item) => {
                const isGhost = () => item.task.id === DRAG_PREVIEW_ID;
                const isDropGhost = () =>
                  dropAnimation()?.task.id === item.task.id;

                if (isGhost()) {
                  return (
                    <li
                      data-preview="true"
                      data-drop-kind="item"
                      data-drop-list={props.listId}
                      data-task-depth={item.depth}
                      style={{
                        "padding-left": `${item.depth * INDENT_PX}px`,
                      }}
                      class={itemClass(true)}
                    >
                      <TaskCard task={item.task} variant="ghost" />
                    </li>
                  );
                }

                return (
                  <li
                    use:draggable={{
                      id: item.task.id,
                      data: {
                        ...item.task,
                        category: getEffectiveCategory(state.tasks, item.task),
                      },
                    }}
                    data-flip-id={item.task.id}
                    data-drop-ghost={isDropGhost() ? "true" : undefined}
                    data-drag-source="list"
                    data-drag-list={props.listId}
                    data-drop-kind="item"
                    data-drop-id={item.task.id}
                    data-drop-list={props.listId}
                    data-task-depth={item.depth}
                    style={{
                      "padding-left": `${item.depth * INDENT_PX}px`,
                    }}
                    class={itemClass(false)}
                  >
                    <TaskCard
                      task={item.task}
                      variant={isDropGhost() ? "ghost" : "normal"}
                      onOpen={props.onOpenTask}
                      onToggleCollapse={(id) => {
                        const top = scrollRef?.scrollTop ?? 0;
                        actions.toggleCollapse(id);
                        if (scrollRef) scrollRef.scrollTop = top;
                      }}
                      onToggleDone={
                        props.cardOptions?.onToggleDone
                          ? (id) => {
                              const top = scrollRef?.scrollTop ?? 0;
                              props.cardOptions?.onToggleDone?.(id);
                              if (scrollRef) scrollRef.scrollTop = top;
                            }
                          : undefined
                      }
                      onContextMenu={handleCardContextMenu}
                      showDueDate={props.cardOptions?.showDueDate ?? false}
                    />
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </div>
      <ContextMenu state={contextMenu()} onClose={() => setContextMenu(null)} />
    </div>
  );
};
