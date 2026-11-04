import { vi } from "vitest";

vi.mock("../store/calendarStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../store/calendarStore")>();
  let mockEvents: any[] = [];
  return {
    ...actual,
    useCalendarStore: () => [
      {
        events: mockEvents,
        accessToken: null,
        tokenExpiresAt: 0,
        lastFetched: 0,
        isLoading: false,
        error: null,
      },
      { connect: vi.fn(), disconnect: vi.fn(), fetchEvents: vi.fn() },
    ],
    __setMockEvents: (events: any[]) => {
      mockEvents = events;
    },
  };
});

import { fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HeaderNowNext } from "./HeaderNowNext";
import { TaskProvider } from "../store/taskStore";
import * as calendarStoreModule from "../store/calendarStore";

const { __setMockEvents } = calendarStoreModule as any;

// 2026-02-23 is a Monday.
const at = (hours: number, minutes: number, day = 23) =>
  new Date(2026, 1, day, hours, minutes, 0, 0);

const slot = (id: string, start: Date, duration: number) => ({
  id,
  start: start.toISOString(),
  duration,
});

const task = (overrides: Record<string, unknown>) => ({
  id: "task-1",
  title: "Write report",
  status: "todo",
  description: "",
  dueDate: null,
  category: null,
  importance: "none",
  urgency: "none",
  subtasks: [],
  scheduledTimes: [],
  ...overrides,
});

const seed = (data: { tasks?: unknown[]; calendarDraftSlots?: unknown[] }) => {
  localStorage.setItem(
    "timeblocks-tasks",
    JSON.stringify({ tasks: [], calendarDraftSlots: [], ...data }),
  );
};

const renderHeaderNowNext = () => {
  const onGoToBlock = vi.fn();
  const result = render(() => (
    <TaskProvider>
      <HeaderNowNext onGoToBlock={onGoToBlock} />
    </TaskProvider>
  ));
  return { ...result, onGoToBlock };
};

const getItem = () =>
  document.querySelector<HTMLButtonElement>("[data-now-next]");

describe("HeaderNowNext", () => {
  beforeEach(() => {
    localStorage.clear();
    __setMockEvents([]);
    vi.useFakeTimers();
    vi.setSystemTime(at(9, 5));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the block in progress with the minutes left", () => {
    seed({
      tasks: [task({ scheduledTimes: [slot("slot-1", at(9, 0), 30)] })],
    });
    renderHeaderNowNext();

    const item = screen.getByRole("button", {
      name: "Now: Write report, 25 minutes left. Show in calendar.",
    });
    expect(item).toHaveAttribute("type", "button");
    expect(item).toHaveAttribute("data-state", "now");
    expect(item).toHaveAttribute("title", "Write report");
    expect(item).toHaveTextContent("Write report");
    expect(item).toHaveTextContent("25m");
  });

  it("shows the next block of today with the minutes until it starts", () => {
    seed({
      tasks: [task({ scheduledTimes: [slot("slot-1", at(9, 15), 30)] })],
    });
    renderHeaderNowNext();

    const item = screen.getByRole("button", {
      name: "Next: Write report, in 10 minutes. Show in calendar.",
    });
    expect(item).toHaveAttribute("data-state", "next");
    expect(item).toHaveTextContent("in 10m");
  });

  it("renders nothing when there is no block now or later today", () => {
    seed({
      tasks: [
        task({ scheduledTimes: [slot("slot-1", at(9, 15, 24), 30)] }),
      ],
    });
    const { container } = renderHeaderNowNext();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not show the words NOW or NEXT", () => {
    seed({
      tasks: [
        task({
          scheduledTimes: [
            slot("slot-1", at(9, 0), 30),
            slot("slot-2", at(10, 0), 30),
          ],
        }),
      ],
    });
    renderHeaderNowNext();
    expect(getItem()?.textContent).not.toMatch(/\b(now|next)\b/i);

    vi.advanceTimersByTime(30 * 60_000);
    expect(getItem()).toHaveAttribute("data-state", "next");
    expect(getItem()?.textContent).not.toMatch(/\b(now|next)\b/i);
  });

  it("counts down when the minute changes", () => {
    seed({
      tasks: [task({ scheduledTimes: [slot("slot-1", at(9, 0), 30)] })],
    });
    renderHeaderNowNext();
    expect(getItem()).toHaveTextContent("25m");

    vi.advanceTimersByTime(60_000);

    expect(getItem()).toHaveTextContent("24m");
    expect(getItem()).toHaveAttribute(
      "aria-label",
      "Now: Write report, 24 minutes left. Show in calendar.",
    );
  });

  it("skips the block of a done task", () => {
    seed({
      tasks: [
        task({
          id: "done-task",
          title: "Finished thing",
          isDone: true,
          scheduledTimes: [slot("slot-done", at(9, 0), 30)],
        }),
        task({
          id: "open-task",
          title: "Open thing",
          scheduledTimes: [slot("slot-open", at(9, 15), 30)],
        }),
      ],
    });
    renderHeaderNowNext();

    expect(getItem()).toHaveAttribute("data-state", "next");
    expect(getItem()).toHaveAttribute("title", "Open thing");
  });

  it("can show a Google Calendar event", () => {
    __setMockEvents([
      {
        id: "event-1",
        title: "Team standup",
        start: at(9, 0),
        end: at(9, 30),
        duration: 30,
      },
    ]);
    renderHeaderNowNext();

    const item = screen.getByRole("button", {
      name: "Now: Team standup, 25 minutes left. Show in calendar.",
    });
    expect(item).toHaveAttribute("data-slot-type", "external");
    expect(item).not.toHaveAttribute("data-category");
  });

  it("can show a routine block with its category", () => {
    seed({
      calendarDraftSlots: [
        {
          id: "draft-1",
          title: "Workout",
          start: at(9, 0).toISOString(),
          duration: 30,
          category: "red",
        },
      ],
    });
    renderHeaderNowNext();

    expect(getItem()).toHaveAttribute("data-slot-type", "draft");
    expect(getItem()).toHaveAttribute("data-category", "red");
  });

  it("shows a block from yesterday that is still running after midnight", () => {
    vi.setSystemTime(at(0, 10, 24));
    seed({
      tasks: [
        task({
          title: "Late shift",
          scheduledTimes: [slot("slot-1", at(23, 30, 23), 60)],
        }),
      ],
    });
    renderHeaderNowNext();

    expect(getItem()).toHaveAttribute("data-state", "now");
    expect(getItem()).toHaveTextContent("20m");
  });

  it("uses the category of the block for data-category", () => {
    seed({
      tasks: [
        task({
          category: "blue",
          scheduledTimes: [slot("slot-1", at(9, 0), 30)],
        }),
      ],
    });
    renderHeaderNowNext();

    expect(getItem()).toHaveAttribute("data-category", "blue");
    expect(getItem()).toHaveAttribute("data-slot-type", "task");
  });

  it("uses the inherited category of a subtask block", () => {
    seed({
      tasks: [
        task({
          id: "parent",
          title: "Project",
          category: "green",
          subtasks: [
            task({
              id: "child",
              title: "Draft intro",
              scheduledTimes: [slot("slot-child", at(9, 0), 30)],
            }),
          ],
        }),
      ],
    });
    renderHeaderNowNext();

    expect(getItem()).toHaveAttribute("title", "Draft intro");
    expect(getItem()).toHaveAttribute("data-category", "green");
  });

  it("has no data-category when the block has no category", () => {
    seed({
      tasks: [task({ scheduledTimes: [slot("slot-1", at(9, 0), 30)] })],
    });
    renderHeaderNowNext();

    expect(getItem()).not.toHaveAttribute("data-category");
  });

  it("calls onGoToBlock with the block when clicked", () => {
    seed({
      tasks: [task({ scheduledTimes: [slot("slot-1", at(9, 0), 30)] })],
    });
    const { onGoToBlock } = renderHeaderNowNext();

    fireEvent.click(getItem()!);

    expect(onGoToBlock).toHaveBeenCalledTimes(1);
    expect(onGoToBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slot-1",
        title: "Write report",
        slotType: "task",
        start: at(9, 0),
        end: at(9, 30),
      }),
    );
  });
});
