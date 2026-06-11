import { describe, expect, it } from "vitest";
import {
  isRoutineRunningLate,
  parsePreviewSlotId,
  previewRoutineForDay,
} from "./routinePreview";
import type { RoutineItem } from "../store/taskStore";

const baseItem = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: "item-1",
  title: "Workout",
  duration: 45,
  homeDay: 1,
  startMinutes: 9 * 60,
  repeatDays: [],
  category: null,
  description: "",
  dueDate: null,
  importance: "none",
  urgency: "none",
  ...overrides,
});

describe("previewRoutineForDay", () => {
  it("returns a preview slot at the template time for a future day", () => {
    // Today: Monday 2026-02-23 09:00. Previewing Friday 2026-02-27.
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const friday = new Date(2026, 1, 27, 0, 0, 0, 0);
    const item = baseItem({
      id: "friday-workout",
      homeDay: 5,
      startMinutes: 9 * 60,
      duration: 45,
      title: "Friday workout",
    });

    const slots = previewRoutineForDay({
      date: friday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: false,
    });

    expect(slots).toHaveLength(1);
    const slot = slots[0];
    expect(slot.templateItemId).toBe("friday-workout");
    expect(slot.title).toBe("Friday workout");
    expect(slot.duration).toBe(45);
    expect(slot.start.getFullYear()).toBe(2026);
    expect(slot.start.getMonth()).toBe(1);
    expect(slot.start.getDate()).toBe(27);
    expect(slot.start.getHours()).toBe(9);
    expect(slot.start.getMinutes()).toBe(0);
  });

  it("returns no preview slots for a date before today", () => {
    // Today: Wednesday 2026-02-25. Previewing Monday 2026-02-23.
    const today = new Date(2026, 1, 25, 9, 0, 0, 0);
    const monday = new Date(2026, 1, 23, 0, 0, 0, 0);
    const item = baseItem({
      id: "monday-workout",
      homeDay: 1,
      startMinutes: 9 * 60,
      duration: 45,
    });

    const slots = previewRoutineForDay({
      date: monday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: false,
    });

    expect(slots).toEqual([]);
  });

  it("returns no preview slots for a FUTURE day once that day has been started (e.g. via mutation)", () => {
    // Today: Mon 2026-02-23. Previewing Fri 2026-02-27 — but Friday has
    // already been started (mutation committed its preview into draft
    // slots), so we must not also surface preview tiles for Friday.
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const friday = new Date(2026, 1, 27, 0, 0, 0, 0);
    const item = baseItem({
      id: "friday-workout",
      homeDay: 5,
      startMinutes: 9 * 60,
      duration: 45,
      title: "Friday workout",
    });

    const slots = previewRoutineForDay({
      date: friday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: true,
    });

    expect(slots).toEqual([]);
  });

  it("returns no preview slots for today once the day has been started", () => {
    // Today: Monday 2026-02-23 09:00. Today is "started" → preview hides.
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const item = baseItem({
      id: "monday-workout",
      homeDay: 1,
      startMinutes: 9 * 60,
      duration: 45,
    });

    const slots = previewRoutineForDay({
      date: today,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: true,
    });

    expect(slots).toEqual([]);
  });

  it("applies a deleted override to remove the preview slot", () => {
    // Today: Monday 2026-02-23. Previewing Friday 2026-02-27.
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const friday = new Date(2026, 1, 27, 0, 0, 0, 0);
    const item = baseItem({
      id: "friday-workout",
      homeDay: 5,
      startMinutes: 9 * 60,
      duration: 45,
      title: "Friday workout",
    });

    const slots = previewRoutineForDay({
      date: friday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: false,
      overrides: {
        itemOverrides: { "friday-workout": { deleted: true } },
        inserts: [],
      },
    });

    expect(slots).toEqual([]);
  });

  it("applies a startMinutes override to move the preview slot", () => {
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const friday = new Date(2026, 1, 27, 0, 0, 0, 0);
    const item = baseItem({
      id: "friday-workout",
      homeDay: 5,
      startMinutes: 9 * 60,
      duration: 45,
      title: "Friday workout",
    });

    const slots = previewRoutineForDay({
      date: friday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: false,
      overrides: {
        itemOverrides: { "friday-workout": { startMinutes: 8 * 60 } },
        inserts: [],
      },
    });

    expect(slots).toHaveLength(1);
    expect(slots[0].start.getHours()).toBe(8);
    expect(slots[0].start.getMinutes()).toBe(0);
  });

  it("applies a duration override to resize the preview slot", () => {
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const friday = new Date(2026, 1, 27, 0, 0, 0, 0);
    const item = baseItem({
      id: "friday-workout",
      homeDay: 5,
      startMinutes: 9 * 60,
      duration: 45,
      title: "Friday workout",
    });

    const slots = previewRoutineForDay({
      date: friday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: false,
      overrides: {
        itemOverrides: { "friday-workout": { duration: 90 } },
        inserts: [],
      },
    });

    expect(slots).toHaveLength(1);
    expect(slots[0].duration).toBe(90);
  });

  it("returns insert slots alongside the regular ghost preview", () => {
    const today = new Date(2026, 1, 23, 9, 0, 0, 0);
    const friday = new Date(2026, 1, 27, 0, 0, 0, 0);
    const item = baseItem({
      id: "friday-workout",
      homeDay: 5,
      startMinutes: 9 * 60,
      duration: 45,
      title: "Friday workout",
    });

    const slots = previewRoutineForDay({
      date: friday,
      now: today,
      weeklyTemplate: [item],
      conflicts: [],
      isStarted: false,
      overrides: {
        itemOverrides: {},
        inserts: [
          {
            id: "insert-1",
            title: "Adhoc",
            category: "blue",
            description: "",
            dueDate: null,
            importance: "none",
            urgency: "none",
            startMinutes: 14 * 60,
            duration: 30,
          },
        ],
      },
    });

    expect(slots).toHaveLength(2);
    const insert = slots.find((s) => s.title === "Adhoc");
    expect(insert).toBeDefined();
    expect(insert!.id).toBe("routine-preview-ins:insert-1:2026-02-27");
    expect(insert!.templateItemId).toBe("insert:insert-1");
    expect(insert!.category).toBe("blue");
    expect(insert!.duration).toBe(30);
    expect(insert!.start.getHours()).toBe(14);
    expect(insert!.start.getMinutes()).toBe(0);
  });
});

describe("parsePreviewSlotId", () => {
  it("parses a template preview slot id", () => {
    const parsed = parsePreviewSlotId(
      "routine-preview:friday-workout:2026-02-27",
    );
    expect(parsed).toEqual({
      kind: "template",
      templateItemId: "friday-workout",
      dateId: "2026-02-27",
    });
  });

  it("parses an insert preview slot id (insert prefix beats template prefix)", () => {
    const parsed = parsePreviewSlotId("routine-preview-ins:abc-123:2026-02-27");
    expect(parsed).toEqual({
      kind: "insert",
      insertId: "abc-123",
      dateId: "2026-02-27",
    });
  });

  it("returns null for non-preview ids", () => {
    expect(parsePreviewSlotId("not-a-preview-id")).toBeNull();
  });
});

describe("isRoutineRunningLate", () => {
  it("returns false when there are no routine items for today", () => {
    // now is a Monday; the only item lives on Saturday.
    const now = new Date(2026, 1, 23, 10, 0, 0, 0);
    const items = [baseItem({ homeDay: 6, startMinutes: 8 * 60 })];
    expect(isRoutineRunningLate(items, now)).toBe(false);
  });

  it("returns false when now is before the earliest item start", () => {
    // Monday 06:00, earliest item at 07:00.
    const now = new Date(2026, 1, 23, 6, 0, 0, 0);
    const items = [baseItem({ homeDay: 1, startMinutes: 7 * 60 })];
    expect(isRoutineRunningLate(items, now)).toBe(false);
  });

  it("returns false when now is exactly the earliest item start", () => {
    const now = new Date(2026, 1, 23, 7, 0, 0, 0);
    const items = [baseItem({ homeDay: 1, startMinutes: 7 * 60 })];
    expect(isRoutineRunningLate(items, now)).toBe(false);
  });

  it("returns true when now is past the earliest item start", () => {
    // Monday 09:07, earliest item at 07:00.
    const now = new Date(2026, 1, 23, 9, 7, 0, 0);
    const items = [
      baseItem({ id: "a", homeDay: 1, startMinutes: 7 * 60 }),
      baseItem({ id: "b", homeDay: 1, startMinutes: 12 * 60 }),
    ];
    expect(isRoutineRunningLate(items, now)).toBe(true);
  });

  it("uses the earliest item across the day, not document order", () => {
    // Monday 07:30: later than the 07:00 item even though it is listed last.
    const now = new Date(2026, 1, 23, 7, 30, 0, 0);
    const items = [
      baseItem({ id: "late", homeDay: 1, startMinutes: 12 * 60 }),
      baseItem({ id: "early", homeDay: 1, startMinutes: 7 * 60 }),
    ];
    expect(isRoutineRunningLate(items, now)).toBe(true);
  });

  it("considers items that repeat onto today's weekday", () => {
    // Monday 09:00; item's home day is Tuesday but it repeats on Monday.
    const now = new Date(2026, 1, 23, 9, 0, 0, 0);
    const items = [baseItem({ homeDay: 2, repeatDays: [1], startMinutes: 7 * 60 })];
    expect(isRoutineRunningLate(items, now)).toBe(true);
  });

  it("rounds now up to the next 15-minute boundary, matching stamping", () => {
    // Item at 07:00; now 07:01 ceils to 07:15 (> 07:00) so it counts as late.
    const now = new Date(2026, 1, 23, 7, 1, 0, 0);
    const items = [baseItem({ homeDay: 1, startMinutes: 7 * 60 })];
    expect(isRoutineRunningLate(items, now)).toBe(true);
  });
});
