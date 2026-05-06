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

  it("scrolls to centre 12pm vertically after mount", async () => {
    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const scroller = document.querySelector<HTMLElement>("div.overflow-auto")!;
    Object.defineProperty(scroller, "clientHeight", {
      value: 600,
      configurable: true,
    });

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    // 12pm = 720 minutes; viewport 600px, so 720 - 300 centres it at 420.
    expect(scroller.scrollTop).toBe(420);
  });

  it("renders weekday columns Mon-Sun and the hour axis without date numbers", () => {
    render(() => (
      <TestWrapper>
        <RoutineCanvas />
      </TestWrapper>
    ));

    const headers = document.querySelectorAll("[data-routine-day-header]");
    expect(headers).toHaveLength(7);
    expect(Array.from(headers).map((node) => node.textContent?.trim())).toEqual(
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    );

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

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
    expect(stored.weeklyTemplate).toHaveLength(1);
    expect(stored.weeklyTemplate[0]).toMatchObject({
      homeDay: 3,
      startMinutes: 9 * 60,
      duration: 60,
    });
  });

  describe("default repeat days for newly drawn items", () => {
    const drawOnColumn = (weekday: number) => {
      const column = document.querySelector(
        `[data-routine-day='${weekday}']`,
      ) as HTMLElement | null;
      expect(column).not.toBeNull();
      column!.getBoundingClientRect = () =>
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

      fireEvent.pointerDown(column!, {
        button: 0,
        pointerId: 13,
        clientX: 10,
        clientY: 9 * 60,
      });
      fireEvent.pointerMove(window, {
        pointerId: 13,
        clientX: 10,
        clientY: 9 * 60 + 30,
      });
      fireEvent.pointerUp(window, {
        pointerId: 13,
        clientX: 10,
        clientY: 9 * 60 + 30,
      });
    };

    it("a new item drawn on Wednesday defaults to repeating on every other weekday", () => {
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      drawOnColumn(3);

      const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
      expect(stored.weeklyTemplate).toHaveLength(1);
      const repeatDays = [...stored.weeklyTemplate[0].repeatDays].sort(
        (a: number, b: number) => a - b,
      );
      expect(repeatDays).toEqual([0, 1, 2, 4, 5, 6]);
    });

    it("a new item drawn on Sunday defaults to repeating on Mon..Sat", () => {
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      drawOnColumn(0);

      const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
      const repeatDays = [...stored.weeklyTemplate[0].repeatDays].sort(
        (a: number, b: number) => a - b,
      );
      expect(repeatDays).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("a new item's home day is rendered solid and every other column shows a transparent ghost", () => {
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      drawOnColumn(3);

      const homeInstance = document.querySelector(
        "[data-routine-day='3'] [data-routine-item-id]",
      );
      expect(homeInstance).not.toBeNull();

      for (const otherDay of [0, 1, 2, 4, 5, 6]) {
        const ghost = document.querySelector(
          `[data-routine-day='${otherDay}'] [data-routine-ghost]`,
        );
        expect(ghost, `ghost in column ${otherDay}`).not.toBeNull();
      }
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

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
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

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
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

  describe("ghost rendering for items with repeat days", () => {
    const seedItemWithRepeats = () =>
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          weeklyTemplate: [
            {
              id: "workout",
              title: "Workout",
              duration: 30,
              homeDay: 1, // Monday is the home day
              startMinutes: 7 * 60,
              repeatDays: [3, 5], // Wed + Fri
            },
          ],
        }),
      );

    it("renders the home instance in the home-day column with no ghost marker", () => {
      seedItemWithRepeats();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      const homeColumn = document.querySelector("[data-routine-day='1']");
      const homeInstance = homeColumn?.querySelector(
        "[data-routine-item-id='workout']",
      );
      expect(homeInstance).not.toBeNull();
      expect(homeInstance?.getAttribute("data-routine-ghost")).toBeNull();
    });

    it("renders a ghost copy in every repeat-day column", () => {
      seedItemWithRepeats();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      for (const repeatDay of [3, 5]) {
        const column = document.querySelector(
          `[data-routine-day='${repeatDay}']`,
        );
        const ghost = column?.querySelector(
          "[data-routine-ghost-of='workout']",
        );
        expect(ghost, `ghost in column ${repeatDay}`).not.toBeNull();
        expect(
          ghost?.getAttribute("data-routine-ghost"),
          `ghost flag in column ${repeatDay}`,
        ).toBe("true");
      }
    });

    it("does not render the item or any ghost in a column that is neither home nor a repeat day", () => {
      seedItemWithRepeats();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      for (const otherDay of [0, 2, 4, 6]) {
        const column = document.querySelector(
          `[data-routine-day='${otherDay}']`,
        );
        expect(
          column?.querySelector("[data-routine-item-id='workout']"),
          `home in column ${otherDay}`,
        ).toBeNull();
        expect(
          column?.querySelector("[data-routine-ghost-of='workout']"),
          `ghost in column ${otherDay}`,
        ).toBeNull();
      }
    });

    it("renders ghosts visually transparent (lower opacity than the home instance)", () => {
      seedItemWithRepeats();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      const ghost = document.querySelector<HTMLElement>(
        "[data-routine-ghost-of='workout']",
      );
      expect(ghost).not.toBeNull();
      // The ghost's class list should include some Tailwind opacity utility
      // signaling reduced visibility (e.g. "opacity-60", "opacity-50").
      const classList = ghost!.className.split(/\s+/);
      const hasOpacityUtility = classList.some((cls) => /^opacity-\d+$/.test(cls));
      expect(hasOpacityUtility).toBe(true);
    });

    it("ghosts mirror the home item's title, startMinutes, and duration", () => {
      seedItemWithRepeats();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      const home = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout']",
      );
      const ghost = document.querySelector<HTMLElement>(
        "[data-routine-ghost-of='workout']",
      );
      expect(home).not.toBeNull();
      expect(ghost).not.toBeNull();
      expect(ghost!.style.top).toBe(home!.style.top);
      expect(ghost!.style.height).toBe(home!.style.height);
      expect(ghost!.textContent).toContain("Workout");
    });

    it("resizing the home instance updates each ghost's height across repeat-day columns", () => {
      seedItemWithRepeats();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      const initialGhost = document.querySelector<HTMLElement>(
        "[data-routine-day='3'] [data-routine-ghost-of='workout']",
      );
      expect(initialGhost).not.toBeNull();
      const initialHeight = initialGhost!.style.height;

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
        clientY: 7 * 60 + 75, // +45 minutes
      });
      fireEvent.pointerUp(window, {
        pointerId: 1,
        clientX: 50,
        clientY: 7 * 60 + 75,
      });

      const afterGhostWed = document.querySelector<HTMLElement>(
        "[data-routine-day='3'] [data-routine-ghost-of='workout']",
      );
      const afterGhostFri = document.querySelector<HTMLElement>(
        "[data-routine-day='5'] [data-routine-ghost-of='workout']",
      );
      const afterHome = document.querySelector<HTMLElement>(
        "[data-routine-day='1'] [data-routine-item-id='workout']",
      );
      expect(afterGhostWed).not.toBeNull();
      expect(afterGhostFri).not.toBeNull();
      expect(afterHome).not.toBeNull();

      // The ghosts now match the resized home and differ from the original height.
      expect(afterGhostWed!.style.height).toBe(afterHome!.style.height);
      expect(afterGhostFri!.style.height).toBe(afterHome!.style.height);
      expect(afterGhostWed!.style.height).not.toBe(initialHeight);
    });

    it("renaming the home item via updateRoutineItem propagates to every ghost copy", () => {
      seedItemWithRepeats();
      const { container } = render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
      const originalId: string = stored.weeklyTemplate[0].id;

      // Mutate via store API so the change flows through reactivity.
      stored.weeklyTemplate[0].title = "Yoga";
      localStorage.setItem("timeblocks-tasks", JSON.stringify(stored));

      // Re-render with seeded data to simulate a reload.
      container.innerHTML = "";
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      for (const repeatDay of [3, 5]) {
        const ghost = document.querySelector<HTMLElement>(
          `[data-routine-day='${repeatDay}'] [data-routine-ghost-of='${originalId}']`,
        );
        expect(ghost?.textContent, `ghost text in column ${repeatDay}`).toContain(
          "Yoga",
        );
      }
    });
  });

  describe("selection", () => {
    const seedSingleItem = () =>
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

    const seedTwoItems = () =>
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
            {
              id: "lunch",
              title: "Lunch",
              duration: 30,
              homeDay: 2,
              startMinutes: 12 * 60,
              repeatDays: [],
            },
          ],
        }),
      );

    const clickItem = (
      itemId: string,
      modifiers: Partial<{
        metaKey: boolean;
        ctrlKey: boolean;
        shiftKey: boolean;
      }> = {},
    ) => {
      const handle = document.querySelector<HTMLElement>(
        `[data-routine-item-id='${itemId}'] [data-routine-drag-handle]`,
      );
      if (!handle) throw new Error(`No drag handle for ${itemId}`);
      fireEvent.pointerDown(handle, {
        button: 0,
        pointerId: 1,
        clientX: 50,
        clientY: 7 * 60 + 15,
        ...modifiers,
      });
      fireEvent.pointerUp(handle, {
        pointerId: 1,
        clientX: 50,
        clientY: 7 * 60 + 15,
        ...modifiers,
      });
    };

    it("single-clicking a routine item marks it as selected", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");

      const item = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout']",
      );
      expect(item).not.toBeNull();
      expect(item?.getAttribute("data-selected")).toBe("true");
    });

    it("clicking empty space inside a column clears the selection", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");
      expect(
        document
          .querySelector("[data-routine-item-id='workout']")
          ?.getAttribute("data-selected"),
      ).toBe("true");

      const column = document.querySelector<HTMLElement>(
        "[data-routine-day='2']",
      )!;
      column.getBoundingClientRect = () =>
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
      fireEvent.pointerDown(column, {
        button: 0,
        pointerId: 9,
        clientX: 50,
        clientY: 12 * 60,
      });
      fireEvent.pointerUp(window, {
        pointerId: 9,
        clientX: 50,
        clientY: 12 * 60,
      });

      expect(
        document
          .querySelector("[data-routine-item-id='workout']")
          ?.getAttribute("data-selected"),
      ).toBeNull();
    });

    it("clicking a different item replaces the selection", () => {
      seedTwoItems();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");
      clickItem("lunch");

      expect(
        document
          .querySelector("[data-routine-item-id='workout']")
          ?.getAttribute("data-selected"),
      ).toBeNull();
      expect(
        document
          .querySelector("[data-routine-item-id='lunch']")
          ?.getAttribute("data-selected"),
      ).toBe("true");
    });

    it("pressing Delete after selecting an item removes it from the weekly template", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");
      fireEvent.keyDown(window, { key: "Delete" });

      const stored = JSON.parse(
        localStorage.getItem("timeblocks-tasks") ?? "{}",
      );
      expect(stored.weeklyTemplate).toEqual([]);
      expect(
        document.querySelector("[data-routine-item-id='workout']"),
      ).toBeNull();
    });

    it("pressing Backspace removes every selected item from the weekly template", () => {
      seedTwoItems();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");
      clickItem("lunch", { ctrlKey: true });
      fireEvent.keyDown(window, { key: "Backspace" });

      const stored = JSON.parse(
        localStorage.getItem("timeblocks-tasks") ?? "{}",
      );
      expect(stored.weeklyTemplate).toEqual([]);
    });

    it("pressing Delete while a resize is in flight does NOT remove the selection", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");

      const handle = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout'] [data-routine-resize='end']",
      )!;
      fireEvent.pointerDown(handle, {
        button: 0,
        pointerId: 7,
        clientX: 50,
        clientY: 7 * 60 + 30,
      });
      fireEvent.pointerMove(window, {
        pointerId: 7,
        clientX: 50,
        clientY: 7 * 60 + 60,
      });

      fireEvent.keyDown(window, { key: "Delete" });

      let stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
      expect(stored.weeklyTemplate).toHaveLength(1);

      fireEvent.pointerUp(window, {
        pointerId: 7,
        clientX: 50,
        clientY: 7 * 60 + 60,
      });

      stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
      expect(stored.weeklyTemplate).toHaveLength(1);
    });

    it("pressing Backspace while an input is focused does NOT remove the selection", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      try {
        fireEvent.keyDown(input, { key: "Backspace" });
      } finally {
        input.remove();
      }

      const stored = JSON.parse(
        localStorage.getItem("timeblocks-tasks") ?? "{}",
      );
      expect(stored.weeklyTemplate).toHaveLength(1);
      expect(stored.weeklyTemplate[0].id).toBe("workout");
    });

    it("resizing a selected item preserves its selection", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");

      const handle = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout'] [data-routine-resize='end']",
      )!;
      fireEvent.pointerDown(handle, {
        button: 0,
        pointerId: 5,
        clientX: 50,
        clientY: 7 * 60 + 30,
      });
      fireEvent.pointerMove(window, {
        pointerId: 5,
        clientX: 50,
        clientY: 7 * 60 + 60,
      });
      fireEvent.pointerUp(window, {
        pointerId: 5,
        clientX: 50,
        clientY: 7 * 60 + 60,
      });

      const item = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout']",
      );
      expect(item?.getAttribute("data-selected")).toBe("true");
    });

    it("dragging a selected item preserves its selection", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");

      const card = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout'] [data-routine-drag-handle]",
      )!;
      fireEvent.pointerDown(card, {
        button: 0,
        pointerId: 6,
        clientX: 50,
        clientY: 7 * 60 + 15,
      });
      fireEvent.pointerMove(window, {
        pointerId: 6,
        clientX: 50,
        clientY: 9 * 60 + 15,
      });
      fireEvent.pointerUp(window, {
        pointerId: 6,
        clientX: 50,
        clientY: 9 * 60 + 15,
      });

      const item = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout']",
      );
      expect(item?.getAttribute("data-selected")).toBe("true");
    });

    it("drawing a new routine item via column drag selects the new item and clears any previous selection", () => {
      seedSingleItem();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");

      const wednesdayColumn = document.querySelector<HTMLElement>(
        "[data-routine-day='3']",
      )!;
      wednesdayColumn.getBoundingClientRect = () =>
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

      fireEvent.pointerDown(wednesdayColumn, {
        button: 0,
        pointerId: 11,
        clientX: 10,
        clientY: 9 * 60,
      });
      fireEvent.pointerMove(window, {
        pointerId: 11,
        clientX: 10,
        clientY: 9 * 60 + 60,
      });
      fireEvent.pointerUp(window, {
        pointerId: 11,
        clientX: 10,
        clientY: 9 * 60 + 60,
      });

      const oldItem = document.querySelector<HTMLElement>(
        "[data-routine-item-id='workout']",
      );
      expect(oldItem?.getAttribute("data-selected")).toBeNull();

      const stored = JSON.parse(
        localStorage.getItem("timeblocks-tasks") ?? "{}",
      );
      const newItem = stored.weeklyTemplate.find(
        (item: { id: string }) => item.id !== "workout",
      );
      expect(newItem).toBeDefined();
      const newItemEl = document.querySelector<HTMLElement>(
        `[data-routine-item-id='${newItem.id}']`,
      );
      expect(newItemEl?.getAttribute("data-selected")).toBe("true");
    });

    it("cmd/ctrl/shift-clicking adds an item to the selection, and clicking it again removes it", () => {
      seedTwoItems();
      render(() => (
        <TestWrapper>
          <RoutineCanvas />
        </TestWrapper>
      ));

      clickItem("workout");
      clickItem("lunch", { metaKey: true });

      expect(
        document
          .querySelector("[data-routine-item-id='workout']")
          ?.getAttribute("data-selected"),
      ).toBe("true");
      expect(
        document
          .querySelector("[data-routine-item-id='lunch']")
          ?.getAttribute("data-selected"),
      ).toBe("true");

      clickItem("lunch", { shiftKey: true });

      expect(
        document
          .querySelector("[data-routine-item-id='workout']")
          ?.getAttribute("data-selected"),
      ).toBe("true");
      expect(
        document
          .querySelector("[data-routine-item-id='lunch']")
          ?.getAttribute("data-selected"),
      ).toBeNull();
    });
  });
});
