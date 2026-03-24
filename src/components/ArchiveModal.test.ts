import { describe, it, expect } from "vitest";
import { collectWeekLeafIds, getWeekKey } from "./ArchiveModal";
import type { Task } from "../store/taskStore";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title: "Test",
  status: "inbox",
  subtasks: [],
  scheduledTimes: [],
  ...overrides,
});

describe("getWeekKey", () => {
  it("returns the same key for dates within the same week", () => {
    const monday = new Date("2025-03-17T10:00:00");
    const wednesday = new Date("2025-03-19T10:00:00");
    const friday = new Date("2025-03-21T10:00:00");
    expect(getWeekKey(monday)).toBe(getWeekKey(wednesday));
    expect(getWeekKey(wednesday)).toBe(getWeekKey(friday));
  });

  it("returns different keys for dates in different weeks", () => {
    const thisWeek = new Date("2025-03-19T10:00:00");
    const nextWeek = new Date("2025-03-26T10:00:00");
    expect(getWeekKey(thisWeek)).not.toBe(getWeekKey(nextWeek));
  });
});

describe("collectWeekLeafIds", () => {
  it("returns the ID of a leaf task completed in the target week", () => {
    const task = makeTask({
      completedAt: "2025-03-18T10:00:00.000Z",
      isDone: true,
    });
    const weekKey = getWeekKey(new Date("2025-03-17T00:00:00"));
    expect(collectWeekLeafIds(task, weekKey)).toEqual([task.id]);
  });

  it("returns empty for a leaf task completed in a different week", () => {
    const task = makeTask({
      completedAt: "2025-03-10T10:00:00.000Z",
      isDone: true,
    });
    const weekKey = getWeekKey(new Date("2025-03-17T00:00:00"));
    expect(collectWeekLeafIds(task, weekKey)).toEqual([]);
  });

  it("returns empty for a leaf with no completedAt", () => {
    const task = makeTask({});
    const weekKey = getWeekKey(new Date("2025-03-17T00:00:00"));
    expect(collectWeekLeafIds(task, weekKey)).toEqual([]);
  });

  it("collects only subtasks in the target week from a parent", () => {
    const sub1 = makeTask({
      completedAt: "2025-03-10T10:00:00.000Z",
      isDone: true,
      isArchived: true,
    });
    const sub2 = makeTask({
      completedAt: "2025-03-17T10:00:00.000Z",
      isDone: true,
      isArchived: true,
    });
    const sub3 = makeTask({
      completedAt: "2025-03-18T14:00:00.000Z",
      isDone: true,
      isArchived: true,
    });
    const parent = makeTask({ subtasks: [sub1, sub2, sub3] });

    const weekKey = getWeekKey(new Date("2025-03-17T00:00:00"));
    const ids = collectWeekLeafIds(parent, weekKey);
    expect(ids).toEqual([sub2.id, sub3.id]);
  });

  it("handles nested subtasks", () => {
    const leaf1 = makeTask({
      completedAt: "2025-03-17T10:00:00.000Z",
      isDone: true,
      isArchived: true,
    });
    const leaf2 = makeTask({
      completedAt: "2025-03-10T10:00:00.000Z",
      isDone: true,
      isArchived: true,
    });
    const midParent = makeTask({ subtasks: [leaf1, leaf2], isArchived: true });
    const parent = makeTask({ subtasks: [midParent] });

    const weekKey = getWeekKey(new Date("2025-03-17T00:00:00"));
    expect(collectWeekLeafIds(parent, weekKey)).toEqual([leaf1.id]);
  });

  it("treats isDone parent as leaf even if it has subtasks", () => {
    const child = makeTask({
      completedAt: "2025-03-10T10:00:00.000Z",
      isDone: true,
    });
    const parent = makeTask({
      completedAt: "2025-03-17T10:00:00.000Z",
      isDone: true,
      subtasks: [child],
    });

    const weekKey = getWeekKey(new Date("2025-03-17T00:00:00"));
    expect(collectWeekLeafIds(parent, weekKey)).toEqual([parent.id]);
  });
});
