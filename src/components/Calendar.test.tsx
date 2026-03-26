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

describe("Calendar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens draft slot modal callback on double click for draft slots", async () => {
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

    const onOpenDraftSlot = vi.fn();
    render(() => (
      <TestWrapper>
        <Calendar onOpenDraftSlot={onOpenDraftSlot} />
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

    expect(onOpenDraftSlot).toHaveBeenCalledTimes(1);
    expect(onOpenDraftSlot).toHaveBeenCalledWith("draft-slot-1");
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

  describe("week navigation", () => {
    function getMonday(d: Date): Date {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function formatLocalDate(d: Date): string {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    it("renders prev and next week buttons", () => {
      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      expect(screen.getByLabelText("Previous week")).toBeInTheDocument();
      expect(screen.getByLabelText("Next week")).toBeInTheDocument();
    });

    it("navigates to previous week when prev button is clicked", async () => {
      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const monday = getMonday(new Date());
      const prevMonday = new Date(monday);
      prevMonday.setDate(prevMonday.getDate() - 7);
      const expectedDateId = formatLocalDate(prevMonday);

      fireEvent.click(screen.getByLabelText("Previous week"));

      await waitFor(() => {
        expect(
          document.querySelector(`[data-day-id="${expectedDateId}"]`),
        ).toBeInTheDocument();
      });
    });

    it("always shows Today button", () => {
      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("returns to current week when Today button is clicked", async () => {
      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const monday = getMonday(new Date());
      const expectedDateId = formatLocalDate(monday);

      fireEvent.click(screen.getByLabelText("Previous week"));

      const prevMonday = new Date(monday);
      prevMonday.setDate(prevMonday.getDate() - 7);
      await waitFor(() => {
        expect(
          document.querySelector(
            `[data-day-id="${formatLocalDate(prevMonday)}"]`,
          ),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Today"));

      await waitFor(() => {
        expect(
          document.querySelector(`[data-day-id="${expectedDateId}"]`),
        ).toBeInTheDocument();
      });
    });

    it("navigates to next week when next button is clicked", async () => {
      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const monday = getMonday(new Date());
      const nextMonday = new Date(monday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const expectedDateId = formatLocalDate(nextMonday);

      fireEvent.click(screen.getByLabelText("Next week"));

      await waitFor(() => {
        expect(
          document.querySelector(`[data-day-id="${expectedDateId}"]`),
        ).toBeInTheDocument();
      });
    });
  });
});
