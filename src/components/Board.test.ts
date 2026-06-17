import { describe, it, expect } from "vitest";
import type { Task } from "../store/taskStore";
import { collectDoneTree, isActiveColumnVisible, isDoneVisible } from "./Board";
import { mapFilteredIndex } from "../utils/dragPreview";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: "task",
    status: "todo",
    subtasks: [],
    scheduledTimes: [],
    ...overrides,
  };
}

describe("isDoneVisible", () => {
  it("returns true for a done task", () => {
    expect(isDoneVisible(makeTask({ isDone: true }))).toBe(true);
  });

  it("returns false for a non-done task with no subtasks", () => {
    expect(isDoneVisible(makeTask({ isDone: false }))).toBe(false);
  });

  it("returns false for an archived done task", () => {
    expect(isDoneVisible(makeTask({ isDone: true, isArchived: true }))).toBe(
      false,
    );
  });

  it("returns true for a non-done task with done subtasks", () => {
    const task = makeTask({
      isDone: false,
      subtasks: [makeTask({ isDone: true })],
    });
    expect(isDoneVisible(task)).toBe(true);
  });

  it("returns false for an archived non-done task with done subtasks", () => {
    const task = makeTask({
      isDone: false,
      isArchived: true,
      subtasks: [makeTask({ isDone: true })],
    });
    expect(isDoneVisible(task)).toBe(false);
  });
});

describe("isActiveColumnVisible", () => {
  it("returns true for a normal not-done task", () => {
    expect(isActiveColumnVisible(makeTask({ isDone: false }))).toBe(true);
  });

  it("returns false for a non-pinned effectively-done task", () => {
    expect(isActiveColumnVisible(makeTask({ isDone: true }))).toBe(false);
  });

  it("returns true for a pinned effectively-done task", () => {
    expect(
      isActiveColumnVisible(makeTask({ isDone: true, isPinned: true })),
    ).toBe(true);
  });

  it("returns true for a pinned task whose subtasks are all done", () => {
    const task = makeTask({
      isDone: false,
      isPinned: true,
      subtasks: [makeTask({ isDone: true })],
    });
    expect(isActiveColumnVisible(task)).toBe(true);
  });

  it("returns false for a pinned archived task (archived always wins)", () => {
    expect(
      isActiveColumnVisible(
        makeTask({ isDone: true, isPinned: true, isArchived: true }),
      ),
    ).toBe(false);
  });

  it("returns false for an archived not-done task", () => {
    expect(
      isActiveColumnVisible(makeTask({ isDone: false, isArchived: true })),
    ).toBe(false);
  });
});

describe("active-column visible children (chevron visibility)", () => {
  it("a pinned parent whose children are all done has no active-column-visible children", () => {
    const parent = makeTask({
      isPinned: true,
      isDone: false,
      subtasks: [makeTask({ isDone: true }), makeTask({ isDone: true })],
    });
    expect(parent.subtasks.some(isActiveColumnVisible)).toBe(false);
  });

  it("a parent with one not-done child has an active-column-visible child", () => {
    const parent = makeTask({
      subtasks: [makeTask({ isDone: true }), makeTask({ isDone: false })],
    });
    expect(parent.subtasks.some(isActiveColumnVisible)).toBe(true);
  });
});

describe("mapFilteredIndex – done column sorting with archived tasks", () => {
  it("skips archived done tasks when computing insertion index", () => {
    const archived = makeTask({ isDone: true, isArchived: true });
    const a = makeTask({ isDone: true });
    const b = makeTask({ isDone: true });
    const c = makeTask({ isDone: true });
    const siblings = [archived, a, b, c];

    // The done column shows [a, b, c] (archived is excluded).
    // Requesting filteredIndex=2 should point to c (the 3rd visible item).
    const actualIndex = mapFilteredIndex(siblings, 2, isDoneVisible);
    expect(actualIndex).toBe(3);
  });

  it("returns correct index with no archived tasks", () => {
    const a = makeTask({ isDone: true });
    const b = makeTask({ isDone: true });
    const c = makeTask({ isDone: true });
    const siblings = [a, b, c];

    expect(mapFilteredIndex(siblings, 0, isDoneVisible)).toBe(0);
    expect(mapFilteredIndex(siblings, 1, isDoneVisible)).toBe(1);
    expect(mapFilteredIndex(siblings, 2, isDoneVisible)).toBe(2);
  });

  it("skips non-done tasks interspersed in the array", () => {
    const todo = makeTask({ isDone: false });
    const a = makeTask({ isDone: true });
    const inProgress = makeTask({ isDone: false });
    const b = makeTask({ isDone: true });
    const siblings = [todo, a, inProgress, b];

    expect(mapFilteredIndex(siblings, 0, isDoneVisible)).toBe(1);
    expect(mapFilteredIndex(siblings, 1, isDoneVisible)).toBe(3);
  });

  it("returns array length when filteredIndex exceeds visible count", () => {
    const a = makeTask({ isDone: true });
    const siblings = [a];

    expect(mapFilteredIndex(siblings, 5, isDoneVisible)).toBe(1);
  });

  it("handles multiple archived tasks before and between done tasks", () => {
    const arch1 = makeTask({ isDone: true, isArchived: true });
    const a = makeTask({ isDone: true });
    const arch2 = makeTask({ isDone: true, isArchived: true });
    const b = makeTask({ isDone: true });
    const siblings = [arch1, a, arch2, b];

    // Visible: [a, b]. filteredIndex=1 should point to b at actual index 3.
    expect(mapFilteredIndex(siblings, 1, isDoneVisible)).toBe(3);
  });
});

describe("collectDoneTree", () => {
  it("excludes a root task with status='note' even when isDone is true", () => {
    const noteTask = makeTask({
      title: "A note",
      status: "note",
      isDone: true,
    });
    const doneTask = makeTask({
      title: "A real done task",
      status: "in_progress",
      isDone: true,
    });

    const tree = collectDoneTree([noteTask, doneTask]);

    expect(tree.map((item) => item.task.id)).toEqual([doneTask.id]);
  });

  it("still includes a pinned parent with done children as a header (isDoneLeaf=false)", () => {
    const doneChild = makeTask({ isDone: true });
    const pinnedParent = makeTask({
      title: "Pinned parent",
      status: "in_progress",
      isPinned: true,
      isDone: false,
      subtasks: [doneChild],
    });

    const tree = collectDoneTree([pinnedParent]);

    expect(tree).toHaveLength(1);
    expect(tree[0].task.id).toBe(pinnedParent.id);
    expect(tree[0].isDoneLeaf).toBe(false);
    expect(tree[0].children.map((c) => c.task.id)).toEqual([doneChild.id]);
  });
});
