import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import { type Component } from "solid-js";
import { TaskEditorModal, type EditorFields } from "./TaskEditorModal";
import { TaskProvider, type Weekday } from "../store/taskStore";

const TestWrapper: Component<{ children: any }> = (props) => {
  return <TaskProvider>{props.children}</TaskProvider>;
};

const noteData = (): EditorFields => ({
  title: "A note",
  category: null,
  dueDate: null,
  importance: "none",
  urgency: "none",
  description: "",
});

const taskDataWithPin =
  (isPinned: boolean): (() => EditorFields) =>
  () => ({
    title: "A task",
    category: null,
    dueDate: null,
    importance: "none",
    urgency: "none",
    description: "",
    isPinned,
  });

describe("TaskEditorModal", () => {
  it("hides the due-date, importance, and urgency controls when kind='note'", () => {
    render(() => (
      <TestWrapper>
        <TaskEditorModal
          itemId="note-1"
          data={noteData}
          onFieldChange={() => {}}
          eyebrow="Edit note"
          heading="Note details"
          idPrefix="task"
          onClose={() => {}}
          kind="note"
        />
      </TestWrapper>
    ));

    expect(screen.queryByLabelText(/due date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/importance/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/urgency/i)).not.toBeInTheDocument();
  });

  it("shows the due-date, importance, and urgency controls by default", () => {
    render(() => (
      <TestWrapper>
        <TaskEditorModal
          itemId="task-1"
          data={noteData}
          onFieldChange={() => {}}
          eyebrow="Edit task"
          idPrefix="task"
          onClose={() => {}}
        />
      </TestWrapper>
    ));

    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/importance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/urgency/i)).toBeInTheDocument();
  });

  it("renders eyebrow, heading, and footer copy from caller-provided props", () => {
    render(() => (
      <TestWrapper>
        <TaskEditorModal
          itemId="note-1"
          data={noteData}
          onFieldChange={() => {}}
          eyebrow="Edit note"
          heading="Note details"
          idPrefix="task"
          onClose={() => {}}
          kind="note"
          footer={<button type="button">Delete note</button>}
        />
      </TestWrapper>
    ));

    expect(screen.getByText("Edit note")).toBeInTheDocument();
    expect(screen.getByText("Note details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete note" }),
    ).toBeInTheDocument();
  });

  describe("Repeats on pill row", () => {
    const monday: Weekday = 1;
    const wednesday: Weekday = 3;
    const friday: Weekday = 5;

    const renderEditor = (
      repeatsOn:
        | {
            homeDay: Weekday;
            selectedDays: Weekday[];
            onToggle: (day: Weekday) => void;
          }
        | undefined,
    ) =>
      render(() => (
        <TestWrapper>
          <TaskEditorModal
            itemId="routine-1"
            data={noteData}
            onFieldChange={() => {}}
            eyebrow="Edit routine"
            idPrefix="routine"
            onClose={() => {}}
            repeatsOn={repeatsOn}
          />
        </TestWrapper>
      ));

    it("renders the pill row in DOM order between the Title input and the Notes textarea", () => {
      renderEditor({
        homeDay: monday,
        selectedDays: [],
        onToggle: () => {},
      });

      const titleInput = document.querySelector("#routine-title")!;
      const description = document.querySelector("#routine-description")!;
      const pillRow = document.querySelector("[data-pill-day]")!;

      expect(
        titleInput.compareDocumentPosition(pillRow) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        pillRow.compareDocumentPosition(description) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("does not render any pill row when repeatsOn is undefined", () => {
      renderEditor(undefined);
      expect(document.querySelectorAll("[data-pill-day]")).toHaveLength(0);
      expect(screen.queryByText(/repeats on/i)).not.toBeInTheDocument();
    });

    it("renders seven weekday pills in Mon-Sun order when repeatsOn is provided", () => {
      renderEditor({
        homeDay: monday,
        selectedDays: [],
        onToggle: () => {},
      });

      const pills = document.querySelectorAll("[data-pill-day]");
      expect(pills).toHaveLength(7);
      const order = Array.from(pills).map((p) =>
        p.getAttribute("data-pill-day"),
      );
      expect(order).toEqual(["1", "2", "3", "4", "5", "6", "0"]);
      expect(screen.getByText(/repeats on/i)).toBeInTheDocument();
    });

    it("marks the home day's pill as the home state", () => {
      renderEditor({
        homeDay: monday,
        selectedDays: [],
        onToggle: () => {},
      });

      const homePill = document.querySelector(`[data-pill-day='${monday}']`);
      expect(homePill?.getAttribute("data-pill-state")).toBe("home");
    });

    it("marks pills in selectedDays as repeat state and others as unselected", () => {
      renderEditor({
        homeDay: monday,
        selectedDays: [wednesday, friday],
        onToggle: () => {},
      });

      expect(
        document
          .querySelector(`[data-pill-day='${wednesday}']`)
          ?.getAttribute("data-pill-state"),
      ).toBe("repeat");
      expect(
        document
          .querySelector(`[data-pill-day='${friday}']`)
          ?.getAttribute("data-pill-state"),
      ).toBe("repeat");
      expect(
        document
          .querySelector(`[data-pill-day='2']`)
          ?.getAttribute("data-pill-state"),
      ).toBe("unselected");
    });

    it("clicking a non-home pill invokes onToggle with that weekday", () => {
      const onToggle = vi.fn();
      renderEditor({
        homeDay: monday,
        selectedDays: [],
        onToggle,
      });

      const wedPill = document.querySelector<HTMLElement>(
        `[data-pill-day='${wednesday}']`,
      );
      expect(wedPill).not.toBeNull();
      fireEvent.click(wedPill!);

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(wednesday);
    });

    it("clicking the home day's pill does not invoke onToggle", () => {
      const onToggle = vi.fn();
      renderEditor({
        homeDay: monday,
        selectedDays: [],
        onToggle,
      });

      const homePill = document.querySelector<HTMLElement>(
        `[data-pill-day='${monday}']`,
      );
      expect(homePill).not.toBeNull();
      fireEvent.click(homePill!);

      expect(onToggle).not.toHaveBeenCalled();
    });

    it("clicking a pill that's already in selectedDays still fires onToggle (caller toggles)", () => {
      const onToggle = vi.fn();
      renderEditor({
        homeDay: monday,
        selectedDays: [wednesday],
        onToggle,
      });

      const wedPill = document.querySelector<HTMLElement>(
        `[data-pill-day='${wednesday}']`,
      );
      fireEvent.click(wedPill!);

      expect(onToggle).toHaveBeenCalledWith(wednesday);
    });
  });

  describe("Pin task toggle", () => {
    it("renders the pin control for a task and toggling it calls onFieldChange with isPinned", () => {
      const onFieldChange = vi.fn();
      render(() => (
        <TestWrapper>
          <TaskEditorModal
            itemId="task-1"
            data={taskDataWithPin(false)}
            onFieldChange={onFieldChange}
            eyebrow="Edit task"
            idPrefix="task"
            onClose={() => {}}
          />
        </TestWrapper>
      ));

      const pin = screen.getByLabelText(/pin task/i);
      expect(pin).toBeInTheDocument();

      fireEvent.click(pin);
      expect(onFieldChange).toHaveBeenCalledWith({ isPinned: true });
    });

    it("does not render the pin control when kind='routine'", () => {
      render(() => (
        <TestWrapper>
          <TaskEditorModal
            itemId="routine-1"
            data={taskDataWithPin(false)}
            onFieldChange={() => {}}
            eyebrow="Edit routine"
            idPrefix="routine"
            onClose={() => {}}
            kind="routine"
          />
        </TestWrapper>
      ));

      expect(screen.queryByLabelText(/pin task/i)).not.toBeInTheDocument();
    });
  });
});
