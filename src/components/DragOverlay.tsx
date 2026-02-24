import {
  type Component,
  Show,
  createEffect,
  createMemo,
  onCleanup,
} from "solid-js";
import { TaskCard } from "./TaskCard";
import {
  activeDragData,
  clearDropAnimation,
  dragOffset,
  dragOver,
  dragPosition,
  dragSize,
  dragSource,
  dropAnimation,
  isDragging,
} from "../store/dragStore";
import {
  DROP_ANIMATION_DURATION,
  DROP_ANIMATION_EASING,
} from "../utils/dropAnimation";

export const DragOverlay: Component = () => {
  const style = createMemo(() => {
    const position = dragPosition();
    const offset = dragOffset();
    const size = dragSize();
    if (!position || !offset) return {};
    return {
      left: `${position.x - offset.x}px`,
      top: `${position.y - offset.y}px`,
      width: size ? `${size.width}px` : "auto",
      height: size ? `${size.height}px` : "auto",
    };
  });

  const shouldShow = () =>
    isDragging() &&
    dragPosition() &&
    activeDragData() &&
    dragSource()?.kind === "list";

  const activeTask = () => {
    const data = activeDragData();
    if (data && typeof data === "object" && "scheduledTimes" in data) {
      return data;
    }
    return null;
  };

  let dropEl: HTMLDivElement | undefined;

  createEffect(() => {
    const animation = dropAnimation();
    const node = dropEl;
    if (!animation || !animation.to || !node) return;

    const { from, to } = animation;
    if (typeof node.animate !== "function") {
      clearDropAnimation();
      return;
    }

    Object.assign(node.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });

    const motion = node.animate(
      [
        {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
        },
        {
          left: `${to.left}px`,
          top: `${to.top}px`,
          width: `${to.width}px`,
          height: `${to.height}px`,
        },
      ],
      {
        duration: DROP_ANIMATION_DURATION,
        easing: DROP_ANIMATION_EASING,
        fill: "forwards",
      },
    );

    motion.onfinish = () => {
      clearDropAnimation();
    };

    onCleanup(() => {
      motion.cancel();
    });
  });

  return (
    <>
      <Show when={shouldShow()}>
        <div
          class={`fixed z-50 pointer-events-none ${
            dragOver()?.kind === "calendar" ? "opacity-40" : ""
          }`}
          style={style() as any}
        >
          <TaskCard task={activeTask()!} variant="overlay" />
        </div>
      </Show>

      <Show when={dropAnimation()?.to}>
        <div
          ref={dropEl}
          class={`fixed z-50 pointer-events-none ${
            dropAnimation()?.kind === "calendar"
              ? "opacity-40 animate-[dropFade_var(--speed-base)_ease-out_forwards]"
              : ""
          }`}
        >
          <TaskCard
            task={dropAnimation()!.task}
            variant="overlay"
            dropSettling={dropAnimation()?.kind !== "calendar"}
          />
        </div>
      </Show>
    </>
  );
};
