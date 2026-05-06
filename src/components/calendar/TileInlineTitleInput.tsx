import { type Component, createEffect, onCleanup } from "solid-js";

// The inline-rename input that sits inside a calendar/routine tile while
// the user is typing a new title. Both the day-grid calendar (for freshly
// drawn draft slots) and the weekly routine canvas (for freshly drawn
// routine items) use this exact control: same chrome, same focus/select
// on mount, same Enter/Escape/blur commit-or-cancel semantics, same
// pointer-down stopPropagation so the surrounding drag/select machinery
// ignores typing. Centralising it ensures a tweak to the rename UI lands
// in both surfaces at once.
export const TileInlineTitleInput: Component<{
  value: string;
  onInput: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}> = (props) => {
  let inputEl: HTMLInputElement | undefined;

  // Mounting the input means inline editing has just begun, so we always
  // grab focus and pre-select the current value (a freshly created item
  // shows its default title selected, ready to be overtyped).
  createEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  return (
    <div class="relative z-3 px-[0.45rem] py-[0.35rem]">
      <input
        ref={inputEl}
        data-no-drag="true"
        value={props.value}
        class="w-full rounded-[10px] border border-(--outline-soft) bg-(--surface-solid) px-[0.38rem] py-[0.2rem] text-xs font-medium text-(--ink) focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)]"
        onInput={(event) => props.onInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            props.onCommit();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            props.onCancel();
          }
        }}
        onBlur={() => props.onCommit()}
        onPointerDown={(event) => event.stopPropagation()}
      />
    </div>
  );
};
