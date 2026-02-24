import { vi } from "vitest";

// Mock the calendarStore before it's imported by components
vi.mock("../store/calendarStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../store/calendarStore")>();
  let mockEvents: any[] = [];
  return {
    ...actual,
    useCalendarStore: () => {
      return [
        {
          events: mockEvents,
          clientId: "",
          accessToken: null,
          tokenExpiresAt: 0,
          isLoading: false,
          error: null,
        },
        {
          setClientId: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
          fetchEvents: vi.fn(),
        },
      ];
    },
    __setMockEvents: (events: any[]) => {
      mockEvents = events;
    },
  };
});

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it } from "vitest";
import { type Component } from "solid-js";
import { Calendar } from "./Calendar";
import { TaskProvider } from "../store/taskStore";

// Get the mocked setter
import * as calendarStoreModule from "../store/calendarStore";
const { __setMockEvents } = calendarStoreModule as any;

const TestWrapper: Component<{ children: any }> = (props) => {
  return <TaskProvider>{props.children}</TaskProvider>;
};

const readStore = () => {
  const raw = localStorage.getItem("timeblocks-tasks");
  if (!raw) return {};
  return JSON.parse(raw) as {
    tasks?: Array<Record<string, unknown>>;
    calendarDraftSlots?: Array<{ title?: string }>;
  };
};

describe("Calendar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renames a calendar-only slot inline without creating tasks", async () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [],
        calendarDraftSlots: [
          {
            id: "draft-slot-1",
            title: "New slot",
            start: new Date().toISOString(),
            duration: 30,
          },
        ],
      }),
    );

    render(() => (
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    ));

    await waitFor(() => {
      expect(screen.getByText("New slot")).toBeInTheDocument();
    });

    const dragHandle = document.querySelector<HTMLElement>(
      '[data-drag-source="calendar"]',
    );
    expect(dragHandle).not.toBeNull();
    fireEvent.doubleClick(dragHandle!);

    const titleInput = await screen.findByDisplayValue("New slot");
    fireEvent.input(titleInput, {
      target: { value: "Planning block" },
    });
    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Planning block")).toBeInTheDocument();
    });

    const stored = readStore();
    expect(Array.isArray(stored.tasks)).toBe(true);
    expect(Array.isArray(stored.calendarDraftSlots)).toBe(true);
    expect(stored.tasks).toHaveLength(0);
    expect(stored.calendarDraftSlots).toHaveLength(1);
    expect(stored.calendarDraftSlots?.[0]?.title).toBe("Planning block");
  });

  it("opens task modal callback on double click for scheduled task slots", async () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "task-123",
            title: "Normal task slot",
            status: "todo",
            description: "",
            dueDate: null,
            category: null,
            importance: "none",
            urgency: "none",
            subtasks: [],
            scheduledTimes: [
              {
                id: "slot-123",
                start: new Date().toISOString(),
                duration: 30,
              },
            ],
          },
        ],
        calendarDraftSlots: [],
      }),
    );

    const onOpenTask = vi.fn();
    render(() => (
      <TestWrapper>
        <Calendar onOpenTask={onOpenTask} />
      </TestWrapper>
    ));

    await waitFor(() => {
      expect(screen.getByText("Normal task slot")).toBeInTheDocument();
    });

    const dragHandle = document.querySelector<HTMLElement>(
      '[data-drag-source="calendar"]',
    );
    expect(dragHandle).not.toBeNull();
    fireEvent.doubleClick(dragHandle!);

    expect(onOpenTask).toHaveBeenCalledTimes(1);
    expect(onOpenTask).toHaveBeenCalledWith("task-123");
  });

  it("renders Google Calendar external events and sets overlap to 50% width", async () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);

    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "task-abc",
            title: "Overlapping task",
            status: "todo",
            scheduledTimes: [
              {
                id: "slot-abc",
                start: today.toISOString(),
                duration: 60,
              },
            ],
          },
        ],
      }),
    );

    __setMockEvents([
      {
        id: "gcal-1",
        title: "Team Meeting",
        start: today,
        end: new Date(today.getTime() + 60 * 60 * 1000),
        duration: 60,
      },
    ]);

    render(() => (
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    ));

    await waitFor(() => {
      expect(screen.getByText("Overlapping task")).toBeInTheDocument();
      expect(screen.getByText("Team Meeting")).toBeInTheDocument();
    });

    const taskEl = screen
      .getByText("Overlapping task")
      .closest("[data-drag-offset-root]");
    const externalEl = screen
      .getByText("Team Meeting")
      .closest("[data-drag-offset-root]");

    expect(taskEl).toHaveStyle({ left: "4px", right: "calc(50% + 2px)" });
    expect(externalEl).toHaveStyle({ left: "calc(50% + 2px)", right: "4px" });
  });
});
