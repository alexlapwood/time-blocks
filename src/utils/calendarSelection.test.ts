import { describe, expect, it, vi } from "vitest";
import {
  CREATE_SLOT_DRAG_THRESHOLD,
  TILE_RESIZE_EDGE_PX,
  createSelectionDeleteHandler,
  isInputFocused,
  toggleSelection,
} from "./calendarSelection";

describe("calendarSelection", () => {
  describe("constants", () => {
    it("exposes a non-zero pointer drag threshold", () => {
      expect(CREATE_SLOT_DRAG_THRESHOLD).toBeGreaterThan(0);
    });

    it("exposes a non-zero tile resize edge size", () => {
      expect(TILE_RESIZE_EDGE_PX).toBeGreaterThan(0);
    });
  });

  describe("toggleSelection", () => {
    it("non-additive click on an item replaces the selection with just that item", () => {
      expect(toggleSelection(["a", "b"], "c", false)).toEqual(["c"]);
    });

    it("non-additive click on the background clears the selection", () => {
      expect(toggleSelection(["a", "b"], null, false)).toEqual([]);
    });

    it("additive click on a new item adds it to the selection", () => {
      expect(toggleSelection(["a"], "b", true)).toEqual(["a", "b"]);
    });

    it("additive click on a selected item removes it", () => {
      expect(toggleSelection(["a", "b", "c"], "b", true)).toEqual(["a", "c"]);
    });

    it("additive click on the background preserves the selection", () => {
      expect(toggleSelection(["a"], null, true)).toEqual(["a"]);
    });
  });

  describe("isInputFocused", () => {
    it("returns false when nothing is focused", () => {
      expect(isInputFocused(null)).toBe(false);
    });

    it("returns true for an INPUT element", () => {
      const el = document.createElement("input");
      expect(isInputFocused(el)).toBe(true);
    });

    it("returns true for a TEXTAREA element", () => {
      const el = document.createElement("textarea");
      expect(isInputFocused(el)).toBe(true);
    });

    it("returns true for a contentEditable element", () => {
      const el = {
        tagName: "DIV",
        isContentEditable: true,
      } as unknown as Element;
      expect(isInputFocused(el)).toBe(true);
    });

    it("returns false for a plain DIV", () => {
      const el = document.createElement("div");
      expect(isInputFocused(el)).toBe(false);
    });
  });

  describe("createSelectionDeleteHandler", () => {
    it("invokes onDelete with the selected ids when Delete is pressed", () => {
      const onDelete = vi.fn();
      const handler = createSelectionDeleteHandler({
        getSelectedIds: () => ["a", "b"],
        isBusy: () => false,
        onDelete,
      });
      handler(new KeyboardEvent("keydown", { key: "Delete" }));
      expect(onDelete).toHaveBeenCalledWith(["a", "b"]);
    });

    it("invokes onDelete when Backspace is pressed", () => {
      const onDelete = vi.fn();
      const handler = createSelectionDeleteHandler({
        getSelectedIds: () => ["a"],
        isBusy: () => false,
        onDelete,
      });
      handler(new KeyboardEvent("keydown", { key: "Backspace" }));
      expect(onDelete).toHaveBeenCalledWith(["a"]);
    });

    it("ignores other keys", () => {
      const onDelete = vi.fn();
      const handler = createSelectionDeleteHandler({
        getSelectedIds: () => ["a"],
        isBusy: () => false,
        onDelete,
      });
      handler(new KeyboardEvent("keydown", { key: "x" }));
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("is a no-op when nothing is selected", () => {
      const onDelete = vi.fn();
      const handler = createSelectionDeleteHandler({
        getSelectedIds: () => [],
        isBusy: () => false,
        onDelete,
      });
      handler(new KeyboardEvent("keydown", { key: "Delete" }));
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("is a no-op when busy (drag/resize in flight)", () => {
      const onDelete = vi.fn();
      const handler = createSelectionDeleteHandler({
        getSelectedIds: () => ["a"],
        isBusy: () => true,
        onDelete,
      });
      handler(new KeyboardEvent("keydown", { key: "Delete" }));
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("is a no-op when an input is focused", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      try {
        const onDelete = vi.fn();
        const handler = createSelectionDeleteHandler({
          getSelectedIds: () => ["a"],
          isBusy: () => false,
          onDelete,
        });
        handler(new KeyboardEvent("keydown", { key: "Delete" }));
        expect(onDelete).not.toHaveBeenCalled();
      } finally {
        input.remove();
      }
    });

    it("calls preventDefault on the matching event", () => {
      const onDelete = vi.fn();
      const handler = createSelectionDeleteHandler({
        getSelectedIds: () => ["a"],
        isBusy: () => false,
        onDelete,
      });
      const event = new KeyboardEvent("keydown", {
        key: "Delete",
        cancelable: true,
      });
      const preventDefault = vi.spyOn(event, "preventDefault");
      handler(event);
      expect(preventDefault).toHaveBeenCalled();
    });
  });
});
