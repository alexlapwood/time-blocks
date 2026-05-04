import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { type Component } from "solid-js";
import { TaskEditorModal, type EditorFields } from "./TaskEditorModal";
import { TaskProvider } from "../store/taskStore";

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
});
