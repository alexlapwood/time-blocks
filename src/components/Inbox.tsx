import { type Component, createMemo, createSignal, For } from "solid-js";
import { cva } from "class-variance-authority";
import { useTaskStore, type Task } from "../store/taskStore";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { TaskCard } from "./TaskCard";
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

const inboxPanelClasses = cva(
  "relative flex h-full flex-col overflow-visible rounded-(--radius-card) border-2 border-(--panel-outline) bg-(--surface-2) py-4 shadow-[var(--shadow-pop),var(--panel-glow)] transition-colors [backdrop-filter:var(--panel-backdrop-filter,none)]",
);

const inboxHeadingClasses = cva(
  "mb-4 px-4 font-display text-[1.2rem] font-bold tracking-[0.02em]",
);

const inboxInputClasses = cva(
  "w-full rounded-(--radius-input) border-2 border-(--outline) bg-(--text-input-bg) px-[0.9rem] py-[0.65rem] font-body font-semibold shadow-(--shadow-tile) transition-[transform,box-shadow,border-color] [transition-duration:var(--speed-base)] focus-visible:-translate-y-px focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
);

const inboxScrollClasses = cva(
  "relative h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-[0.6rem] [scrollbar-gutter:auto] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink-muted)_58%,transparent)_transparent] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--ink-muted)_58%,transparent)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--ink-muted)_74%,transparent)]",
);

const inboxItemClasses = cva("mb-2", {
  variants: {
    ghost: {
      true: "pointer-events-none",
      false: "transition-opacity",
    },
  },
  defaultVariants: {
    ghost: false,
  },
});

const INDENT_PX = 24;

export const Inbox: Component<{ onOpenTask?: (taskId: string) => void }> = (
  props,
) => {
  const [state, actions] = useTaskStore();
  const [inputValue, setInputValue] = createSignal("");
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>(null);
  let scrollRef: HTMLDivElement | undefined;

  const handleTaskContextMenu = (event: MouseEvent, taskId: string) => {
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: "Edit", onClick: () => props.onOpenTask?.(taskId) },
        {
          label: "Delete",
          danger: true,
          onClick: () => actions.deleteTask(taskId),
        },
      ],
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && inputValue().trim()) {
      actions.addTask(inputValue().trim());
      setInputValue("");
    }
  };

  const inboxTasks = () => state.tasks.filter((t) => t.status === "inbox");
  const flatTasks = createMemo(() => flattenTasks(inboxTasks()));

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
      "inbox",
      isDragging(),
      dragSource(),
    ),
  );

  const handleDrop = (draggedId: string, info: DropInfo) => {
    const over = info.over;
    if (!over || over.kind !== "list" || over.listId !== "inbox") return;
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
        actions.moveTaskToStatusAtIndex(draggedId, "inbox", childIndex);
      }
    });
  };

  return (
    <div
      use:droppable={{ id: "inbox", kind: "list", onDrop: handleDrop }}
      class={inboxPanelClasses()}
    >
      <div class="pointer-events-none absolute inset-0 rounded-[inherit] bg-(--panel-highlight)" />
      <h2 class={`relative z-1 ${inboxHeadingClasses()}`}>Inbox</h2>

      <div class="relative z-1 mb-4 px-4">
        <input
          type="text"
          placeholder="Add a task..."
          class={inboxInputClasses()}
          value={inputValue()}
          onInput={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div class="relative z-1 flex-1 min-h-0">
        <div ref={scrollRef} class={inboxScrollClasses()}>
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
                      data-drop-list="inbox"
                      data-task-depth={item.depth}
                      style={{
                        "padding-left": `${item.depth * INDENT_PX}px`,
                      }}
                      class={inboxItemClasses({ ghost: true })}
                    >
                      <TaskCard task={item.task} variant="ghost" />
                    </li>
                  );
                }

                return (
                  <li
                    use:draggable={{
                      id: item.task.id,
                      data: item.task,
                    }}
                    data-flip-id={item.task.id}
                    data-drop-ghost={
                      isDropGhost() ? "true" : undefined
                    }
                    data-drag-source="list"
                    data-drag-list="inbox"
                    data-drop-kind="item"
                    data-drop-id={item.task.id}
                    data-drop-list="inbox"
                    data-task-depth={item.depth}
                    style={{
                      "padding-left": `${item.depth * INDENT_PX}px`,
                    }}
                    class={inboxItemClasses()}
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
                      onContextMenu={handleTaskContextMenu}
                      showDueDate
                    />
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </div>
      <ContextMenu
        state={contextMenu()}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};
