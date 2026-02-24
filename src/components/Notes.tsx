import { type Component, createSignal, onMount } from "solid-js";
import { cva } from "class-variance-authority";

const NOTES_STORAGE_KEY = "timeblocks-notes";

const notesPanelClasses = cva(
  "relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--panel-outline) bg-(--surface-2) shadow-[var(--shadow-pop),var(--panel-glow)] transition-colors [backdrop-filter:var(--panel-backdrop-filter,none)]",
);

const notesPanelHeaderClasses = cva(
  "relative z-1 flex items-center justify-between px-4 pt-4",
);

const notesHeadingClasses = cva(
  "font-display text-[1.2rem] font-bold tracking-[0.02em]",
);

const notesTextareaClasses = cva(
  "h-full w-full resize-none rounded-(--radius-input) border-2 border-(--outline) bg-(--text-input-bg) px-[0.9rem] py-[0.65rem] font-body font-semibold leading-relaxed shadow-[var(--shadow-tile)] transition-[transform,box-shadow,border-color] [transition-duration:var(--speed-base)] focus-visible:translate-y-[-1px] focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink-muted)_58%,transparent)_transparent] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--ink-muted)_58%,transparent)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--ink-muted)_74%,transparent)]",
);

const readSavedNotes = () => {
  try {
    return localStorage.getItem(NOTES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const saveNotes = (value: string) => {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures (private mode/quota).
  }
};

export const Notes: Component = () => {
  const [notes, setNotes] = createSignal("");

  onMount(() => {
    setNotes(readSavedNotes());
  });

  return (
    <div class={notesPanelClasses()}>
      <div class="pointer-events-none absolute inset-0 rounded-[inherit] bg-(--panel-highlight)" />
      <div class={notesPanelHeaderClasses()}>
        <h2 class={notesHeadingClasses()}>Notes</h2>
      </div>
      <div class="relative z-1 flex-1 min-h-0 p-4 pt-3">
        <textarea
          class={notesTextareaClasses()}
          value={notes()}
          onInput={(event) => {
            const value = event.currentTarget.value;
            setNotes(value);
            saveNotes(value);
          }}
        />
      </div>
    </div>
  );
};
