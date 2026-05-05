// Selection primitives shared by the calendar and the routine canvas.
//
// The two views handle very different content (real dates with external
// events vs. a 7-column weekday template), but their selection state machine
// — single-click selects, additive cmd/ctrl/shift-click toggles, click on
// background clears, Delete/Backspace removes the selection, while a
// drag/resize is in flight or an input is focused the shortcut is suppressed —
// is identical. This module is the single source of truth for those
// behaviours so a fix in one view always lands in the other.

// Pointer movement (in CSS pixels) below which a pointerdown→pointerup
// counts as a click rather than a drag. Used by the column-background
// "draw to create" gesture and by the per-item click-to-select gesture in
// both the calendar and the routine canvas.
export const CREATE_SLOT_DRAG_THRESHOLD = 4;

// Vertical extent (in CSS pixels) of the resize edges on a calendar/
// routine tile. Mirrors the `--resize-edge` CSS variable used in the tile
// CVA so both views always agree on hit area.
export const TILE_RESIZE_EDGE_PX = 10;

// Toggle one slot id into / out of the current selection.
//
// - additive=false: replaces the selection with [slotId] (or clears when
//   slotId is null).
// - additive=true: adds slotId when missing, removes it when already
//   present (so cmd-click on a selected item deselects it). A null slotId
//   in additive mode is a no-op so background-clicks with a modifier
//   preserve the selection.
export function toggleSelection(
  current: string[],
  slotId: string | null,
  additive: boolean,
): string[] {
  if (slotId === null) {
    return additive ? current : [];
  }
  if (!additive) return [slotId];
  if (current.includes(slotId)) {
    return current.filter((id) => id !== slotId);
  }
  return [...current, slotId];
}

// True when `active` is an input/textarea/contentEditable element. The
// Delete/Backspace shortcut must be a no-op while the user is typing, so
// pressing Backspace inside a title field never wipes the selected slot.
export function isInputFocused(active: Element | null): boolean {
  if (!active) return false;
  const el = active as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

export type SelectionDeleteHandlerOptions = {
  // Returns the currently-selected ids. Re-evaluated on each keypress so
  // callers can pass any kind of reactive accessor.
  getSelectedIds: () => string[];
  // Returns true when a drag, resize, or any other gesture that should
  // suppress the keyboard delete is in flight. The handler is a no-op
  // while busy so a user mid-resize never accidentally wipes their slot.
  isBusy: () => boolean;
  // Invoked with the selection snapshot when Delete/Backspace fires while
  // the gating conditions allow it. Implementations should remove every
  // id and clear their own selection state.
  onDelete: (selectedIds: string[]) => void;
};

// Build a window-keydown handler that implements the shared
// "selected-slots Delete/Backspace" shortcut. The Calendar and the
// RoutineCanvas both install it via createEffect/onCleanup.
export function createSelectionDeleteHandler(
  options: SelectionDeleteHandlerOptions,
): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const ids = options.getSelectedIds();
    if (ids.length === 0) return;
    if (options.isBusy()) return;
    if (isInputFocused(document.activeElement)) return;
    event.preventDefault();
    options.onDelete(ids);
  };
}
