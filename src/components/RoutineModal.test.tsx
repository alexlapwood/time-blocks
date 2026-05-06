import { fireEvent, render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it } from "vitest";
import { type Component } from "solid-js";
import { RoutineModal } from "./RoutineModal";
import { TaskProvider } from "../store/taskStore";

const TestWrapper: Component<{ children: any }> = (props) => (
  <TaskProvider>{props.children}</TaskProvider>
);

const seedItemWithRepeats = () =>
  localStorage.setItem(
    "timeblocks-tasks",
    JSON.stringify({
      weeklyTemplate: [
        {
          id: "workout",
          title: "Workout",
          duration: 30,
          homeDay: 1, // Monday
          startMinutes: 7 * 60,
          repeatDays: [3, 5], // Wed + Fri
        },
      ],
    }),
  );

const openEditor = () => {
  const handle = document.querySelector<HTMLElement>(
    "[data-routine-item-id='workout'] [data-routine-drag-handle]",
  );
  if (!handle) throw new Error("No drag handle for workout");
  fireEvent.doubleClick(handle);
};

describe("RoutineModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not show due-date, importance, or urgency controls in the routine item editor", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    openEditor();

    expect(screen.queryByLabelText(/due date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/importance/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/urgency/i)).not.toBeInTheDocument();
  });

  it("opens the routine item editor with the home/repeat days pill row when a card is double-clicked", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    openEditor();

    expect(screen.getByText(/repeats on/i)).toBeInTheDocument();
    expect(
      document
        .querySelector("[data-pill-day='1']")
        ?.getAttribute("data-pill-state"),
    ).toBe("home");
    expect(
      document
        .querySelector("[data-pill-day='3']")
        ?.getAttribute("data-pill-state"),
    ).toBe("repeat");
    expect(
      document
        .querySelector("[data-pill-day='5']")
        ?.getAttribute("data-pill-state"),
    ).toBe("repeat");
    expect(
      document
        .querySelector("[data-pill-day='2']")
        ?.getAttribute("data-pill-state"),
    ).toBe("unselected");
  });

  it("clicking an unselected pill adds that weekday to the routine item's repeatDays", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    openEditor();

    const thursdayPill = document.querySelector<HTMLElement>(
      "[data-pill-day='4']",
    );
    expect(thursdayPill?.getAttribute("data-pill-state")).toBe("unselected");
    fireEvent.click(thursdayPill!);

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
    expect(stored.weeklyTemplate[0].repeatDays).toEqual(
      expect.arrayContaining([3, 5, 4]),
    );

    const ghost = document.querySelector(
      "[data-routine-day='4'] [data-routine-ghost-of='workout']",
    );
    expect(ghost).not.toBeNull();

    expect(
      document
        .querySelector("[data-pill-day='4']")
        ?.getAttribute("data-pill-state"),
    ).toBe("repeat");
  });

  it("clicking a repeat pill removes that weekday from the routine item's repeatDays", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    openEditor();

    const wedPill = document.querySelector<HTMLElement>("[data-pill-day='3']");
    expect(wedPill?.getAttribute("data-pill-state")).toBe("repeat");
    fireEvent.click(wedPill!);

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
    expect(stored.weeklyTemplate[0].repeatDays).toEqual([5]);

    const ghost = document.querySelector(
      "[data-routine-day='3'] [data-routine-ghost-of='workout']",
    );
    expect(ghost).toBeNull();

    expect(
      document
        .querySelector("[data-pill-day='3']")
        ?.getAttribute("data-pill-state"),
    ).toBe("unselected");
  });

  it("double-clicking a ghost opens the home item's editor with the Repeats on row visible (no detach)", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    const ghostHandle = document.querySelector<HTMLElement>(
      "[data-routine-day='3'] [data-routine-ghost-of='workout'] [data-routine-drag-handle]",
    );
    expect(ghostHandle).not.toBeNull();
    fireEvent.doubleClick(ghostHandle!);

    expect(screen.getByText(/repeats on/i)).toBeInTheDocument();
    expect(
      document
        .querySelector("[data-pill-day='1']")
        ?.getAttribute("data-pill-state"),
    ).toBe("home");
    expect(
      document
        .querySelector("[data-pill-day='3']")
        ?.getAttribute("data-pill-state"),
    ).toBe("repeat");
  });

  it("editing a ghost's title via the modal updates the home item's title in place (no clone)", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    const ghostHandle = document.querySelector<HTMLElement>(
      "[data-routine-day='3'] [data-routine-ghost-of='workout'] [data-routine-drag-handle]",
    );
    expect(ghostHandle).not.toBeNull();
    fireEvent.doubleClick(ghostHandle!);

    const titleInput = document.querySelector<HTMLInputElement>(
      "#routine-item-title",
    );
    expect(titleInput).not.toBeNull();
    fireEvent.input(titleInput!, { target: { value: "Yoga" } });

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
    expect(stored.weeklyTemplate).toHaveLength(1);
    expect(stored.weeklyTemplate[0].id).toBe("workout");
    expect(stored.weeklyTemplate[0].title).toBe("Yoga");
    expect(stored.weeklyTemplate[0].repeatDays).toEqual([3, 5]);
  });

  it("right-clicking a ghost and choosing Edit opens the home item's editor (not a detach editor)", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    const ghost = document.querySelector<HTMLElement>(
      "[data-routine-day='3'] [data-routine-ghost-of='workout']",
    );
    expect(ghost).not.toBeNull();
    fireEvent.contextMenu(ghost!);
    fireEvent.click(screen.getByText("Edit"));

    expect(screen.getByText(/repeats on/i)).toBeInTheDocument();
    expect(
      document
        .querySelector("[data-pill-day='1']")
        ?.getAttribute("data-pill-state"),
    ).toBe("home");
  });

  it("clicking the home day's pill is a no-op", () => {
    seedItemWithRepeats();
    render(() => (
      <TestWrapper>
        <RoutineModal open={true} onClose={() => {}} />
      </TestWrapper>
    ));

    openEditor();

    const homePill = document.querySelector<HTMLElement>("[data-pill-day='1']");
    fireEvent.click(homePill!);

    const stored = JSON.parse(localStorage.getItem("timeblocks-tasks") ?? "{}");
    expect(stored.weeklyTemplate[0].repeatDays).toEqual([3, 5]);
    expect(stored.weeklyTemplate[0].homeDay).toBe(1);
  });
});
