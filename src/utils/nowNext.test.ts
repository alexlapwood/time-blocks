import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  formatNowNextLabel,
  formatNowNextText,
  pickNowNext,
  toNowNextBlocks,
  type NowNextBlock,
} from "./nowNext";
import type { CalendarSlot } from "./dragPreview";
import type { Task } from "../store/taskStore";

const at = (hours: number, minutes = 0, seconds = 0, date = 2) =>
  new Date(2026, 10, date, hours, minutes, seconds, 0);

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task",
  title: "Task",
  status: "todo",
  subtasks: [],
  scheduledTimes: [],
  ...overrides,
});

const taskSlot = (
  id: string,
  taskId: string,
  start: Date | string,
  duration = 30,
): CalendarSlot => ({
  id,
  taskId,
  slotType: "task",
  title: taskId,
  category: null,
  scheduledTime: start,
  duration,
});

const block = (
  overrides: Partial<NowNextBlock> & { id: string },
): NowNextBlock => ({
  title: overrides.id,
  start: at(9),
  end: at(10),
  slotType: "task",
  ...overrides,
});

describe("toNowNextBlocks", () => {
  it("maps a task slot to a block that ends start + duration", () => {
    const tasks = [makeTask({ id: "write", title: "Write report" })];
    const slots: CalendarSlot[] = [
      {
        id: "write-slot",
        taskId: "write",
        slotType: "task",
        title: "Write report",
        category: "blue",
        scheduledTime: at(9).toISOString(),
        duration: 45,
      },
    ];

    expect(toNowNextBlocks(slots, tasks)).toEqual([
      {
        id: "write-slot",
        title: "Write report",
        start: at(9),
        end: at(9, 45),
        slotType: "task",
        category: "blue",
      },
    ]);
  });

  it("keeps draft and external blocks and drops routine ghosts", () => {
    const slots: CalendarSlot[] = [
      {
        id: "draft",
        taskId: "draft",
        slotType: "draft",
        title: "Gym",
        category: "red",
        scheduledTime: at(7),
        duration: 60,
        templateItemId: "routine-gym",
      },
      {
        id: "routine-preview:item:2026-11-02",
        taskId: "routine-preview:item:2026-11-02",
        slotType: "preview",
        title: "Ghost",
        category: null,
        scheduledTime: at(8),
        duration: 30,
        templateItemId: "item",
      },
      {
        id: "gcal-1",
        taskId: "gcal-1",
        slotType: "external",
        title: "Standup",
        category: null,
        scheduledTime: at(10),
        duration: 15,
      },
    ];

    const blocks = toNowNextBlocks(slots, []);

    expect(blocks.map((b) => [b.id, b.slotType, b.title])).toEqual([
      ["draft", "draft", "Gym"],
      ["gcal-1", "external", "Standup"],
    ]);
    expect(blocks[0].category).toBe("red");
    expect(blocks[1].category).toBeUndefined();
    expect(blocks[1].end).toEqual(at(10, 15));
  });

  it("drops every block of a done task, including later blocks", () => {
    const tasks = [
      makeTask({ id: "done", isDone: true }),
      makeTask({ id: "open" }),
    ];
    const slots = [
      taskSlot("done-early", "done", at(8)),
      taskSlot("open-slot", "open", at(9)),
      taskSlot("done-later", "done", at(15)),
    ];

    expect(toNowNextBlocks(slots, tasks).map((b) => b.id)).toEqual([
      "open-slot",
    ]);
  });

  it("judges a subtask block by the subtask's own task", () => {
    const tasks = [
      makeTask({
        id: "parent",
        subtasks: [
          makeTask({ id: "child-done", parentId: "parent", isDone: true }),
          makeTask({ id: "child-open", parentId: "parent" }),
        ],
      }),
      makeTask({
        id: "finished-parent",
        subtasks: [
          makeTask({ id: "only-child", parentId: "finished-parent", isDone: true }),
        ],
      }),
    ];
    const slots = [
      taskSlot("parent-slot", "parent", at(9)),
      taskSlot("child-done-slot", "child-done", at(10)),
      taskSlot("child-open-slot", "child-open", at(11)),
      taskSlot("finished-parent-slot", "finished-parent", at(12)),
    ];

    expect(toNowNextBlocks(slots, tasks).map((b) => b.id)).toEqual([
      "parent-slot",
      "child-open-slot",
    ]);
  });
});

describe("pickNowNext", () => {
  it("returns the current block with minutes left", () => {
    const result = pickNowNext(
      [block({ id: "a", start: at(9), end: at(10) })],
      at(9, 35),
    );

    expect(result).toEqual({
      kind: "now",
      block: expect.objectContaining({ id: "a" }),
      minutesLeft: 25,
    });
  });

  it("treats start as inclusive and end as exclusive", () => {
    const blocks = [
      block({ id: "ended", start: at(8), end: at(9) }),
      block({ id: "starting", start: at(9), end: at(9, 30) }),
    ];

    expect(pickNowNext(blocks, at(9))).toMatchObject({
      kind: "now",
      block: { id: "starting" },
      minutesLeft: 30,
    });
  });

  it("picks the overlapping block that ends first", () => {
    const blocks = [
      block({ id: "long", start: at(9), end: at(11) }),
      block({ id: "short", start: at(9, 15), end: at(9, 45) }),
    ];

    expect(pickNowNext(blocks, at(9, 30))).toMatchObject({
      kind: "now",
      block: { id: "short" },
    });
  });

  it("breaks overlap ties by earliest start, then type, then id", () => {
    const now = at(9, 30);

    expect(
      pickNowNext(
        [
          block({ id: "later-start", start: at(9, 15), end: at(10) }),
          block({ id: "earlier-start", start: at(9), end: at(10) }),
        ],
        now,
      ),
    ).toMatchObject({ block: { id: "earlier-start" } });

    expect(
      pickNowNext(
        [
          block({ id: "a-external", slotType: "external" }),
          block({ id: "b-draft", slotType: "draft" }),
          block({ id: "c-task", slotType: "task" }),
        ],
        now,
      ),
    ).toMatchObject({ block: { id: "c-task" } });

    expect(
      pickNowNext(
        [
          block({ id: "a-external", slotType: "external" }),
          block({ id: "b-draft", slotType: "draft" }),
        ],
        now,
      ),
    ).toMatchObject({ block: { id: "b-draft" } });

    expect(
      pickNowNext([block({ id: "b" }), block({ id: "a" })], now),
    ).toMatchObject({ block: { id: "a" } });
  });

  it("returns the next block with minutes until it starts", () => {
    const blocks = [
      block({ id: "past", start: at(7), end: at(8) }),
      block({ id: "later", start: at(13), end: at(14) }),
      block({ id: "soon", start: at(9, 40), end: at(10) }),
    ];

    expect(pickNowNext(blocks, at(9, 30))).toEqual({
      kind: "next",
      block: expect.objectContaining({ id: "soon" }),
      minutesUntil: 10,
    });
  });

  it("breaks next ties by smallest end, then type, then id", () => {
    const now = at(8);

    expect(
      pickNowNext(
        [
          block({ id: "a-long", start: at(9), end: at(11) }),
          block({ id: "b-short", start: at(9), end: at(9, 30) }),
        ],
        now,
      ),
    ).toMatchObject({ kind: "next", block: { id: "b-short" } });

    expect(
      pickNowNext(
        [
          block({ id: "a-external", slotType: "external" }),
          block({ id: "b-draft", slotType: "draft" }),
        ],
        now,
      ),
    ).toMatchObject({ kind: "next", block: { id: "b-draft" } });

    expect(
      pickNowNext([block({ id: "b" }), block({ id: "a" })], now),
    ).toMatchObject({ kind: "next", block: { id: "a" } });
  });

  it("only looks for a next block before the next local midnight", () => {
    const now = at(23);
    const tomorrow = block({
      id: "tomorrow",
      start: at(0, 0, 0, 3),
      end: at(0, 30, 0, 3),
    });

    expect(pickNowNext([tomorrow], now)).toBeNull();
    expect(
      pickNowNext(
        [tomorrow, block({ id: "late", start: at(23, 59), end: at(0, 0, 0, 3) })],
        now,
      ),
    ).toMatchObject({ kind: "next", block: { id: "late" }, minutesUntil: 59 });
  });

  it("rounds minutes up so a live countdown never shows 0", () => {
    expect(
      pickNowNext([block({ id: "a", start: at(9), end: at(9, 54, 30) })], at(9, 30)),
    ).toMatchObject({ kind: "now", minutesLeft: 25 });

    expect(
      pickNowNext([block({ id: "a", start: at(9), end: at(9, 30, 30) })], at(9, 30)),
    ).toMatchObject({ kind: "now", minutesLeft: 1 });

    expect(
      pickNowNext(
        [block({ id: "a", start: at(9, 30, 30), end: at(10) })],
        at(9, 30),
      ),
    ).toMatchObject({ kind: "next", minutesUntil: 1 });
  });

  it("returns null when nothing is current or upcoming today", () => {
    expect(pickNowNext([], at(9))).toBeNull();
    expect(
      pickNowNext([block({ id: "past", start: at(7), end: at(8) })], at(9)),
    ).toBeNull();
  });
});

describe("formatCountdown", () => {
  it.each([
    [1, "1m"],
    [25, "25m"],
    [60, "1h"],
    [80, "1h 20m"],
    [120, "2h"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatCountdown(minutes)).toBe(expected);
  });
});

describe("formatNowNextText", () => {
  it("shows the time left for the current block", () => {
    expect(
      formatNowNextText({ kind: "now", block: block({ id: "a" }), minutesLeft: 25 }),
    ).toBe("25m");
  });

  it("shows the time until the next block", () => {
    expect(
      formatNowNextText({
        kind: "next",
        block: block({ id: "a" }),
        minutesUntil: 10,
      }),
    ).toBe("in 10m");
  });
});

describe("formatNowNextLabel", () => {
  it("describes the current block", () => {
    expect(
      formatNowNextLabel({
        kind: "now",
        block: block({ id: "a", title: "Write report" }),
        minutesLeft: 25,
      }),
    ).toBe("Now: Write report, 25 minutes left. Show in calendar.");
  });

  it("describes the next block", () => {
    expect(
      formatNowNextLabel({
        kind: "next",
        block: block({ id: "a", title: "Standup" }),
        minutesUntil: 10,
      }),
    ).toBe("Next: Standup, in 10 minutes. Show in calendar.");
  });

  it.each([
    [1, "1 minute"],
    [2, "2 minutes"],
    [60, "1 hour"],
    [80, "1 hour 20 minutes"],
    [120, "2 hours"],
  ])("spells out %i minutes as %s", (minutes, words) => {
    const title = block({ id: "a", title: "Focus" });

    expect(
      formatNowNextLabel({ kind: "now", block: title, minutesLeft: minutes }),
    ).toBe(`Now: Focus, ${words} left. Show in calendar.`);
    expect(
      formatNowNextLabel({ kind: "next", block: title, minutesUntil: minutes }),
    ).toBe(`Next: Focus, in ${words}. Show in calendar.`);
  });
});
