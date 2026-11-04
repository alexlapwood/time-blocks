import { describe, expect, it } from "vitest";
import { collectRealSlotsForDate } from "./daySlots";
import type { CalendarDraftSlot, Task } from "../store/taskStore";
import type { ExternalEvent } from "../store/calendarStore";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Task",
  status: "todo",
  subtasks: [],
  scheduledTimes: [],
  ...overrides,
});

const day = new Date(2026, 10, 2, 0, 0, 0, 0);
const at = (hours: number, minutes = 0, date = 2) =>
  new Date(2026, 10, date, hours, minutes, 0, 0);

describe("collectRealSlotsForDate", () => {
  it("builds a task block with the task's own category", () => {
    const tasks = [
      makeTask({
        id: "write",
        title: "Write report",
        category: "blue",
        scheduledTimes: [{ id: "slot-1", start: at(9), duration: 45 }],
      }),
    ];

    expect(
      collectRealSlotsForDate(day, { tasks, draftSlots: [], externalEvents: [] }),
    ).toEqual([
      {
        id: "slot-1",
        taskId: "write",
        slotType: "task",
        title: "Write report",
        category: "blue",
        scheduledTime: at(9),
        duration: 45,
      },
    ]);
  });

  it("gives a subtask block the parent's category and the subtask's own title and id", () => {
    const tasks = [
      makeTask({
        id: "parent",
        title: "Parent",
        category: "green",
        subtasks: [
          makeTask({
            id: "child",
            title: "Child step",
            parentId: "parent",
            scheduledTimes: [
              { id: "child-slot", start: at(14).toISOString(), duration: 20 },
            ],
          }),
        ],
      }),
    ];

    const slots = collectRealSlotsForDate(day, {
      tasks,
      draftSlots: [],
      externalEvents: [],
    });

    expect(slots).toEqual([
      {
        id: "child-slot",
        taskId: "child",
        slotType: "task",
        title: "Child step",
        category: "green",
        scheduledTime: at(14).toISOString(),
        duration: 20,
      },
    ]);
  });

  it("builds a draft block and keeps its template item id", () => {
    const draftSlots: CalendarDraftSlot[] = [
      {
        id: "draft-1",
        title: "Gym",
        start: at(7),
        duration: 60,
        category: "red",
        templateItemId: "routine-gym",
      },
      { id: "draft-2", title: "Untitled", start: at(8), duration: 30 },
    ];

    expect(
      collectRealSlotsForDate(day, { tasks: [], draftSlots, externalEvents: [] }),
    ).toEqual([
      {
        id: "draft-1",
        taskId: "draft-1",
        slotType: "draft",
        title: "Gym",
        category: "red",
        scheduledTime: at(7),
        duration: 60,
        templateItemId: "routine-gym",
      },
      {
        id: "draft-2",
        taskId: "draft-2",
        slotType: "draft",
        title: "Untitled",
        category: null,
        scheduledTime: at(8),
        duration: 30,
        templateItemId: undefined,
      },
    ]);
  });

  it("builds an external event block", () => {
    const externalEvents: ExternalEvent[] = [
      {
        id: "gcal-1",
        title: "Standup",
        start: at(10),
        end: at(10, 15),
        duration: 15,
      },
    ];

    expect(
      collectRealSlotsForDate(day, { tasks: [], draftSlots: [], externalEvents }),
    ).toEqual([
      {
        id: "gcal-1",
        taskId: "gcal-1",
        slotType: "external",
        title: "Standup",
        category: null,
        scheduledTime: at(10),
        duration: 15,
      },
    ]);
  });

  it("orders task blocks first, then drafts, then external events", () => {
    const slots = collectRealSlotsForDate(day, {
      tasks: [
        makeTask({
          id: "late-task",
          scheduledTimes: [{ id: "task-slot", start: at(20), duration: 30 }],
        }),
      ],
      draftSlots: [{ id: "draft", title: "Draft", start: at(8), duration: 30 }],
      externalEvents: [
        { id: "event", title: "Event", start: at(6), end: at(7), duration: 60 },
      ],
    });

    expect(slots.map((slot) => slot.id)).toEqual([
      "task-slot",
      "draft",
      "event",
    ]);
  });

  it("excludes blocks that start on other days", () => {
    const slots = collectRealSlotsForDate(day, {
      tasks: [
        makeTask({
          id: "multi-day",
          scheduledTimes: [
            { id: "yesterday", start: at(9, 0, 1), duration: 30 },
            { id: "today", start: at(9), duration: 30 },
            { id: "tomorrow", start: at(0, 0, 3), duration: 30 },
          ],
        }),
      ],
      draftSlots: [
        { id: "draft-tomorrow", title: "Later", start: at(9, 0, 3), duration: 30 },
      ],
      externalEvents: [
        {
          id: "event-yesterday",
          title: "Old",
          start: at(23, 30, 1),
          end: at(0, 30),
          duration: 60,
        },
      ],
    });

    expect(slots.map((slot) => slot.id)).toEqual(["today"]);
  });

  it("falls back to a 30 minute duration when a task or draft slot has none", () => {
    const slots = collectRealSlotsForDate(day, {
      tasks: [
        makeTask({
          scheduledTimes: [
            { id: "no-duration", start: at(9) } as Task["scheduledTimes"][number],
          ],
        }),
      ],
      draftSlots: [
        { id: "draft-no-duration", title: "Draft", start: at(10) } as CalendarDraftSlot,
      ],
      externalEvents: [],
    });

    expect(slots.map((slot) => slot.duration)).toEqual([30, 30]);
  });
});
