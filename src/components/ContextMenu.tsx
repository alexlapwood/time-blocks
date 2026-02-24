import { type Component, For, Show, createEffect, onCleanup } from "solid-js";

export type ContextMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

export type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
} | null;

export const ContextMenu: Component<{
  state: ContextMenuState;
  onClose: () => void;
}> = (props) => {
  createEffect(() => {
    if (!props.state) return;

    const close = () => props.onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const handleScroll = () => close();

    const frame = requestAnimationFrame(() => {
      window.addEventListener("pointerdown", close);
    });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    onCleanup(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    });
  });

  return (
    <Show when={props.state}>
      {(menu) => (
        <div
          popover="manual"
          ref={(el) => {
            requestAnimationFrame(() => {
              if (!el.isConnected) return;
              el.showPopover();
              const rect = el.getBoundingClientRect();
              if (rect.right > window.innerWidth - 8) {
                el.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
              }
              if (rect.bottom > window.innerHeight - 8) {
                el.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
              }
            });
          }}
          class="min-w-[160px] rounded-[12px] border-2 border-(--outline) bg-(--surface-solid) p-[0.35rem] shadow-(--shadow-pop)"
          style={{
            inset: "unset",
            left: `${menu().x}px`,
            top: `${menu().y}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <For each={menu().items}>
            {(item) => (
              <button
                type="button"
                class={`w-full text-left rounded-[8px] border border-transparent px-[0.7rem] py-[0.4rem] text-[0.85rem] font-semibold cursor-pointer transition-colors bg-transparent ${
                  item.danger
                    ? "text-(--danger) hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                    : "text-(--ink) hover:bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]"
                }`}
                onClick={() => {
                  item.onClick();
                  props.onClose();
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      )}
    </Show>
  );
};
