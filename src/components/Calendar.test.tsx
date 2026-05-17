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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Component } from "solid-js";
import { Calendar } from "./Calendar";
import { TaskProvider } from "../store/taskStore";
import { __triggerDrop } from "../directives/dnd";
import {
  setActiveDragId,
  setActiveDragData,
  setDragSource,
  setIsDragging,
  clearDragState,
} from "../store/dragStore";

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

  it("lays three overlapping events out as thirds of the day's width", async () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);

    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "task-1",
            title: "Task one",
            status: "todo",
            scheduledTimes: [
              { id: "slot-1", start: today.toISOString(), duration: 60 },
            ],
          },
          {
            id: "task-2",
            title: "Task two",
            status: "todo",
            scheduledTimes: [
              { id: "slot-2", start: today.toISOString(), duration: 60 },
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
      expect(screen.getByText("Task one")).toBeInTheDocument();
      expect(screen.getByText("Task two")).toBeInTheDocument();
      expect(screen.getByText("Team Meeting")).toBeInTheDocument();
    });

    const tiles = ["Task one", "Task two", "Team Meeting"].map((title) =>
      screen.getByText(title).closest("[data-drag-offset-root]"),
    ) as HTMLElement[];

    // Tasks come before externals in the calendar's slot iteration order,
    // so Task one → lane 0 (left), Task two → lane 1 (middle), Team
    // Meeting → lane 2 (right). Each tile is a third of the day's width.
    const oneThird = (100 * 1) / 3;
    const twoThirds = (100 * 2) / 3;
    expect(tiles[0]).toHaveStyle({
      left: "4px",
      right: `calc(${twoThirds}% + 2px)`,
    });
    expect(tiles[1]).toHaveStyle({
      left: `calc(${oneThird}% + 2px)`,
      right: `calc(${oneThird}% + 2px)`,
    });
    expect(tiles[2]).toHaveStyle({
      left: `calc(${twoThirds}% + 2px)`,
      right: "4px",
    });
  });

  it("lays four overlapping events out as quarters of the day's width", async () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);

    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "task-1",
            title: "Task one",
            status: "todo",
            scheduledTimes: [
              { id: "slot-1", start: today.toISOString(), duration: 60 },
            ],
          },
          {
            id: "task-2",
            title: "Task two",
            status: "todo",
            scheduledTimes: [
              { id: "slot-2", start: today.toISOString(), duration: 60 },
            ],
          },
          {
            id: "task-3",
            title: "Task three",
            status: "todo",
            scheduledTimes: [
              { id: "slot-3", start: today.toISOString(), duration: 60 },
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
      expect(screen.getByText("Task one")).toBeInTheDocument();
      expect(screen.getByText("Task two")).toBeInTheDocument();
      expect(screen.getByText("Task three")).toBeInTheDocument();
      expect(screen.getByText("Team Meeting")).toBeInTheDocument();
    });

    const tiles = ["Task one", "Task two", "Task three", "Team Meeting"].map(
      (title) => screen.getByText(title).closest("[data-drag-offset-root]"),
    ) as HTMLElement[];

    expect(tiles[0]).toHaveStyle({ left: "4px", right: "calc(75% + 2px)" });
    expect(tiles[1]).toHaveStyle({
      left: "calc(25% + 2px)",
      right: "calc(50% + 2px)",
    });
    expect(tiles[2]).toHaveStyle({
      left: "calc(50% + 2px)",
      right: "calc(25% + 2px)",
    });
    expect(tiles[3]).toHaveStyle({
      left: "calc(75% + 2px)",
      right: "4px",
    });
  });

  it("does not split events that don't actually overlap in time", async () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const later = new Date(today.getTime() + 90 * 60 * 1000);

    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "task-early",
            title: "Early task",
            status: "todo",
            scheduledTimes: [
              { id: "slot-early", start: today.toISOString(), duration: 30 },
            ],
          },
          {
            id: "task-later",
            title: "Later task",
            status: "todo",
            scheduledTimes: [
              { id: "slot-later", start: later.toISOString(), duration: 30 },
            ],
          },
        ],
      }),
    );

    __setMockEvents([]);

    render(() => (
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    ));

    await waitFor(() => {
      expect(screen.getByText("Early task")).toBeInTheDocument();
      expect(screen.getByText("Later task")).toBeInTheDocument();
    });

    const earlyEl = screen
      .getByText("Early task")
      .closest("[data-drag-offset-root]");
    const laterEl = screen
      .getByText("Later task")
      .closest("[data-drag-offset-root]");

    expect(earlyEl).toHaveStyle({ left: "4px", right: "4px" });
    expect(laterEl).toHaveStyle({ left: "4px", right: "4px" });
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

  describe("routine preview", () => {
    // Freeze time inside this block to make day-of-week deterministic.
    // Wed 2026-02-25 09:00 local → Friday 2026-02-27 is a future day in
    // the same visible week.
    const FROZEN_NOW = new Date(2026, 1, 25, 9, 0, 0, 0);

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FROZEN_NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("renders a preview tile on a future day for a routine item whose home day is that future weekday", async () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "friday-workout",
              title: "Friday workout",
              duration: 45,
              homeDay: 5, // Friday
              startMinutes: 9 * 60,
              repeatDays: [],
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
        const tile = document.querySelector(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"]',
        );
        expect(tile).not.toBeNull();
        expect(tile?.textContent).toContain("Friday workout");
      });
    });

    it("renders preview tiles with reduced opacity to distinguish them from committed tiles", async () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "friday-workout",
              title: "Friday workout",
              duration: 45,
              homeDay: 5,
              startMinutes: 9 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const tile = await waitFor(() => {
        const found = document.querySelector(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"]',
        ) as HTMLElement | null;
        expect(found).not.toBeNull();
        return found!;
      });

      expect(tile.className).toMatch(/opacity-50/);
    });

    it("dragging a preview slot commits the day and moves the now-real draft slot to the drop position", async () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "friday-workout",
              title: "Friday workout",
              duration: 45,
              homeDay: 5,
              startMinutes: 9 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const previewId = "routine-preview:friday-workout:2026-02-27";

      // Wait for the preview tile to render (proxy for "the day is mounted").
      await waitFor(() => {
        const tile = document.querySelector(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"]',
        );
        expect(tile).not.toBeNull();
      });

      // The DayHeader and DayBody both render a wrapper with
      // data-day-id={dateStr}. Find the DayBody by selecting any element
      // whose ancestor has the matching day id and which itself is the
      // droppable target.
      const allDayElements = Array.from(
        document.querySelectorAll('[data-day-id="2026-02-27"]'),
      );
      let fridayDropTarget: HTMLElement | null = null;
      for (const el of allDayElements) {
        const found = el.querySelector(
          '[data-drop-kind="calendar-day"]',
        ) as HTMLElement | null;
        if (found) {
          fridayDropTarget = found;
          break;
        }
      }
      expect(fridayDropTarget).not.toBeNull();

      // Simulate the drag being in flight. The drag source carries the
      // preview slot's payload so handleDrop can recognize it.
      setActiveDragId(previewId);
      setActiveDragData({
        id: previewId,
        taskId: previewId,
        slotType: "preview",
        title: "Friday workout",
        category: null,
        scheduledTime: new Date(2026, 1, 27, 9, 0, 0, 0),
        duration: 45,
        templateItemId: "friday-workout",
      } as any);
      setDragSource({ kind: "calendar", date: "2026-02-27" });
      setIsDragging(true);

      try {
        __triggerDrop(fridayDropTarget!, previewId, {
          kind: "calendar",
          date: "2026-02-27",
          minutes: 11 * 60,
        });
      } finally {
        clearDragState();
      }

      await waitFor(() => {
        const stored = JSON.parse(
          localStorage.getItem("timeblocks-tasks") ?? "{}",
        );
        const drafts = (stored.calendarDraftSlots ?? []) as Array<{
          id: string;
          start: string;
          duration: number;
          templateItemId?: string;
        }>;
        expect(drafts).toHaveLength(1);
        const slot = drafts[0];
        expect(slot.id).toBe(previewId);
        expect(slot.templateItemId).toBe("friday-workout");
        expect(slot.duration).toBe(45);
        const start = new Date(slot.start);
        expect(start.getDate()).toBe(27);
        expect(start.getHours()).toBe(11);
        expect(start.getMinutes()).toBe(0);
      });
    });

    it("pressing Delete on a selected preview tile commits the day and removes that one slot, keeping the other routine items committed", async () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "friday-workout",
              title: "Friday workout",
              duration: 45,
              homeDay: 5,
              startMinutes: 9 * 60,
              repeatDays: [],
            },
            {
              id: "friday-lunch",
              title: "Friday lunch",
              duration: 30,
              homeDay: 5,
              startMinutes: 12 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const handle = await waitFor(() => {
        const found = document.querySelector(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"][data-category=""], [data-day-id="2026-02-27"] [data-slot-type="preview"]',
        ) as HTMLElement | null;
        // Just grab any preview tile — we'll select the workout below.
        const all = document.querySelectorAll(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"] [data-preview-handle="true"]',
        );
        expect(all.length).toBeGreaterThan(0);
        return (all[0] as HTMLElement) ?? found!;
      });

      // Select the first preview tile (the workout, sorted by time).
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 50, clientY: 50 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 50, clientY: 50 });

      // Press Delete to remove it.
      fireEvent.keyDown(window, { key: "Delete" });

      await waitFor(() => {
        const stored = JSON.parse(
          localStorage.getItem("timeblocks-tasks") ?? "{}",
        );
        const drafts = (stored.calendarDraftSlots ?? []) as Array<{
          id: string;
          templateItemId?: string;
        }>;
        const fridayDrafts = drafts.filter((slot) =>
          slot.id.endsWith(":2026-02-27"),
        );
        // Only the lunch should remain — the workout was deleted; the rest
        // of the day was committed in the same gesture.
        expect(fridayDrafts).toHaveLength(1);
        expect(fridayDrafts[0].templateItemId).toBe("friday-lunch");
      });
    });

    it("does not show preview tiles for a day after one of its preview tiles has been committed (no duplicates)", async () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "friday-workout",
              title: "Friday workout",
              duration: 45,
              homeDay: 5,
              startMinutes: 9 * 60,
              repeatDays: [],
            },
            {
              id: "friday-lunch",
              title: "Friday lunch",
              duration: 30,
              homeDay: 5,
              startMinutes: 12 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      // Wait for both preview tiles to render initially.
      await waitFor(() => {
        const tiles = document.querySelectorAll(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"]',
        );
        expect(tiles.length).toBe(2);
      });

      // Find the drop target for Friday.
      const allDayElements = Array.from(
        document.querySelectorAll('[data-day-id="2026-02-27"]'),
      );
      let fridayDropTarget: HTMLElement | null = null;
      for (const el of allDayElements) {
        const found = el.querySelector(
          '[data-drop-kind="calendar-day"]',
        ) as HTMLElement | null;
        if (found) {
          fridayDropTarget = found;
          break;
        }
      }
      expect(fridayDropTarget).not.toBeNull();

      const previewId = "routine-preview:friday-workout:2026-02-27";
      setActiveDragId(previewId);
      setActiveDragData({
        id: previewId,
        taskId: previewId,
        slotType: "preview",
        title: "Friday workout",
        category: null,
        scheduledTime: new Date(2026, 1, 27, 9, 0, 0, 0),
        duration: 45,
        templateItemId: "friday-workout",
      } as any);
      setDragSource({ kind: "calendar", date: "2026-02-27" });
      setIsDragging(true);

      try {
        __triggerDrop(fridayDropTarget!, previewId, {
          kind: "calendar",
          date: "2026-02-27",
          minutes: 10 * 60,
        });
      } finally {
        clearDragState();
      }

      // After commit: Friday should show exactly 2 draft slots (the
      // committed routine items) and ZERO preview tiles. No duplicates.
      await waitFor(() => {
        const previewTiles = document.querySelectorAll(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"]',
        );
        const draftTiles = document.querySelectorAll(
          '[data-day-id="2026-02-27"] [data-slot-type="draft"]',
        );
        expect(previewTiles.length).toBe(0);
        expect(draftTiles.length).toBe(2);
      });
    });

    it("today's preview shifts forward as time crosses a 15-minute boundary", async () => {
      // Wednesday 2026-02-25. Routine item homed on Wed at 9am.
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "wed-workout",
              title: "Wed workout",
              duration: 30,
              homeDay: 3, // Wednesday
              startMinutes: 9 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      // Initial preview anchors at 09:00 (template time, since now is also
      // 09:00 and ceilToFifteen(540) === 540). top = 540px.
      const tile = await waitFor(() => {
        const found = document.querySelector(
          '[data-day-id="2026-02-25"] [data-slot-type="preview"]',
        ) as HTMLElement | null;
        expect(found).not.toBeNull();
        return found!;
      });
      expect(tile.style.top).toBe("540px");

      // Advance system time past the next 15-min boundary (to 09:16) and
      // fire one minute-tick interval. The preview should re-derive and
      // anchor at 09:30 (top = 570px).
      vi.setSystemTime(new Date(2026, 1, 25, 9, 16, 0, 0));
      vi.advanceTimersByTime(60 * 1000);

      await waitFor(() => {
        const updated = document.querySelector(
          '[data-day-id="2026-02-25"] [data-slot-type="preview"]',
        ) as HTMLElement | null;
        expect(updated).not.toBeNull();
        expect(updated!.style.top).toBe("570px");
      });
    });

    it("selects a preview tile on click without committing the day", async () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [],
          calendarDraftSlots: [],
          weeklyTemplate: [
            {
              id: "friday-workout",
              title: "Friday workout",
              duration: 45,
              homeDay: 5,
              startMinutes: 9 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

      render(() => (
        <TestWrapper>
          <Calendar />
        </TestWrapper>
      ));

      const handle = await waitFor(() => {
        const found = document.querySelector(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"] [data-preview-handle="true"]',
        ) as HTMLElement | null;
        expect(found).not.toBeNull();
        return found!;
      });

      // Trigger a pointer down/up cycle without movement — the tile should
      // be selected, but no draft slot should be committed in the store.
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 50, clientY: 50 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 50, clientY: 50 });

      await waitFor(() => {
        const updated = document.querySelector(
          '[data-day-id="2026-02-27"] [data-slot-type="preview"]',
        ) as HTMLElement | null;
        expect(updated).not.toBeNull();
        expect(updated?.getAttribute("data-selected")).toBe("true");
      });

      // No real draft slot should have been added — the day stays in
      // preview state until a mutation occurs.
      const stored = JSON.parse(
        localStorage.getItem("timeblocks-tasks") ?? "{}",
      );
      const drafts = (stored.calendarDraftSlots ?? []) as Array<{
        templateItemId?: string;
      }>;
      expect(drafts.filter((slot) => slot.templateItemId)).toHaveLength(0);
    });
  });
});
