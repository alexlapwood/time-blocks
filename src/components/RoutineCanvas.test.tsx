import { fireEvent, render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Component } from "solid-js";
import { RoutineCanvas } from "./RoutineCanvas";
import { TaskProvider } from "../store/taskStore";

const TestWrapper: Component<{ children: any }> = (props) => (
  <TaskProvider>{props.children}</TaskProvider>
);

describe("RoutineCanvas", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders weekday columns Mon-Sun and the hour axis without date numbers", () => {
    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const headers = document.querySelectorAll(
      "[data-routine-day-header]",
    );
    expect(headers).toHaveLength(7);
    expect(
      Array.from(headers).map((node) => node.textContent?.trim()),
    ).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

    const dayBodies = document.querySelectorAll("[data-routine-day]");
    expect(dayBodies).toHaveLength(7);

    expect(screen.getByText("12am")).toBeInTheDocument();
    expect(screen.getByText("11pm")).toBeInTheDocument();

    for (const header of headers) {
      expect(/[0-9]/.test(header.textContent ?? "")).toBe(false);
    }
  });

  it("creates a new routine item on click-and-drag inside the column it was drawn on", () => {
    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const wednesdayColumn = document.querySelector(
      "[data-routine-day='3']",
    ) as HTMLElement | null;
    expect(wednesdayColumn).not.toBeNull();
    const target = wednesdayColumn!;
    target.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 24 * 60,
        height: 24 * 60,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.pointerDown(target, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 9 * 60,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 10,
      clientY: 9 * 60 + 60,
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 10,
      clientY: 9 * 60 + 60,
    });

    const stored = JSON.parse(
      localStorage.getItem("timeblocks-tasks") ?? "{}",
    );
    expect(stored.weeklyTemplate).toHaveLength(1);
    expect(stored.weeklyTemplate[0]).toMatchObject({
      homeDay: 3,
      startMinutes: 9 * 60,
      duration: 60,
    });
  });

  it("resizing an item via the bottom edge updates its stored duration", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        weeklyTemplate: [
          {
            id: "workout",
            title: "Workout",
            duration: 30,
            homeDay: 1,
            startMinutes: 7 * 60,
            repeatDays: [],
          },
        ],
      }),
    );

    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const handle = document.querySelector<HTMLElement>(
      "[data-routine-item-id='workout'] [data-routine-resize='end']",
    );
    expect(handle).not.toBeNull();
    fireEvent.pointerDown(handle!, {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 7 * 60 + 30,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 50,
      clientY: 7 * 60 + 60,
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 50,
      clientY: 7 * 60 + 60,
    });

    const stored = JSON.parse(
      localStorage.getItem("timeblocks-tasks") ?? "{}",
    );
    expect(stored.weeklyTemplate[0].duration).toBe(60);
    expect(stored.weeklyTemplate[0].startMinutes).toBe(7 * 60);
  });

  it("dragging an item vertically updates its stored startMinutes", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        weeklyTemplate: [
          {
            id: "workout",
            title: "Workout",
            duration: 30,
            homeDay: 1,
            startMinutes: 7 * 60,
            repeatDays: [],
          },
        ],
      }),
    );

    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const card = document.querySelector<HTMLElement>(
      "[data-routine-item-id='workout'] [data-routine-drag-handle]",
    );
    expect(card).not.toBeNull();
    fireEvent.pointerDown(card!, {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 7 * 60 + 15,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 50,
      clientY: 9 * 60 + 15,
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 50,
      clientY: 9 * 60 + 15,
    });

    const stored = JSON.parse(
      localStorage.getItem("timeblocks-tasks") ?? "{}",
    );
    expect(stored.weeklyTemplate[0].startMinutes).toBe(9 * 60);
    expect(stored.weeklyTemplate[0].homeDay).toBe(1);
  });

  it("calls the open-item callback when an item is double-clicked", async () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        weeklyTemplate: [
          {
            id: "workout",
            title: "Workout",
            duration: 30,
            homeDay: 1,
            startMinutes: 7 * 60,
            repeatDays: [],
          },
        ],
      }),
    );

    const onOpenItem = vi.fn();
    render(() => (
      <TestWrapper>
        <RoutineCanvas onOpenItem={onOpenItem} />
      </TestWrapper>
    ));

    const card = document.querySelector<HTMLElement>(
      "[data-routine-item-id='workout'] [data-routine-drag-handle]",
    );
    expect(card).not.toBeNull();
    fireEvent.doubleClick(card!);
    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith("workout");
  });

  it("right-clicking an item exposes Edit and Delete in a context menu", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        weeklyTemplate: [
          {
            id: "workout",
            title: "Workout",
            duration: 30,
            homeDay: 1,
            startMinutes: 7 * 60,
            repeatDays: [],
          },
        ],
      }),
    );

    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const item = document.querySelector<HTMLElement>(
      "[data-routine-item-id='workout']",
    );
    expect(item).not.toBeNull();
    fireEvent.contextMenu(item!);

    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders an existing routine item only inside its home-day column", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        weeklyTemplate: [
          {
            id: "workout",
            title: "Morning workout",
            duration: 45,
            homeDay: 1,
            startMinutes: 7 * 60,
            repeatDays: [],
          },
        ],
      }),
    );

    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const card = screen.getByText("Morning workout");
    const column = card.closest("[data-routine-day]");
    expect(column).not.toBeNull();
    expect(column?.getAttribute("data-routine-day")).toBe("1");
  });
});
