import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { TaskCard } from "./TaskCard";
import { type Task, TaskProvider } from "../store/taskStore";

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Task title",
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

describe("TaskCard", () => {
  it("shows a description icon indicator when notes exist", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ description: "Has notes" })} />
      </TaskProvider>
    ));

    const indicator = screen.getByLabelText("Has description");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("role", "img");
    expect(indicator).not.toHaveClass("badge");
  });

  it("does not show a description icon indicator for empty notes", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ description: "   " })} />
      </TaskProvider>
    ));
    expect(screen.queryByLabelText("Has description")).not.toBeInTheDocument();
  });
});

describe("TaskCard pinned indicator", () => {
  it("shows a pin indicator when the task is pinned", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ isPinned: true })} />
      </TaskProvider>
    ));

    const indicator = screen.getByLabelText("Pinned");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("role", "img");
    expect(screen.getByRole("img", { name: "Pinned" })).toBe(indicator);
  });

  it("does not show a pin indicator when isPinned is false", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ isPinned: false })} />
      </TaskProvider>
    ));
    expect(screen.queryByLabelText("Pinned")).not.toBeInTheDocument();
  });

  it("does not show a pin indicator when isPinned is absent", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask()} />
      </TaskProvider>
    ));
    expect(screen.queryByLabelText("Pinned")).not.toBeInTheDocument();
  });

  it("shows the pin indicator regardless of done state", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ isPinned: true, isDone: true })} />
      </TaskProvider>
    ));
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("shows the pin indicator regardless of status", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ isPinned: true, status: "note" })} />
      </TaskProvider>
    ));
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });
});

describe("TaskCard collapse toggle (chevron)", () => {
  const withSubtasks = (overrides: Partial<Task> = {}): Task =>
    createTask({
      subtasks: [createTask({ id: "sub-1", title: "Subtask" })],
      ...overrides,
    });

  it("hides the chevron when hasVisibleSubtasks is false even though the task has subtasks", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={withSubtasks()} hasVisibleSubtasks={false} />
      </TaskProvider>
    ));
    expect(screen.queryByLabelText("Toggle subtasks")).not.toBeInTheDocument();
  });

  it("shows the chevron when hasVisibleSubtasks is true", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={withSubtasks()} hasVisibleSubtasks={true} />
      </TaskProvider>
    ));
    expect(screen.getByLabelText("Toggle subtasks")).toBeInTheDocument();
  });

  it("falls back to showing the chevron for a task with subtasks when the prop is omitted", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={withSubtasks()} />
      </TaskProvider>
    ));
    expect(screen.getByLabelText("Toggle subtasks")).toBeInTheDocument();
  });

  it("does not show the chevron for a task with no subtasks when the prop is omitted", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask()} />
      </TaskProvider>
    ));
    expect(screen.queryByLabelText("Toggle subtasks")).not.toBeInTheDocument();
  });
});

describe("TaskCard for notes", () => {
  it("does not render a checkbox when status is 'note'", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ status: "note" })} />
      </TaskProvider>
    ));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("does render a checkbox when status is not 'note'", () => {
    render(() => (
      <TaskProvider>
        <TaskCard task={createTask({ status: "todo" })} />
      </TaskProvider>
    ));
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("does not render a due-date badge when status is 'note'", () => {
    render(() => (
      <TaskProvider>
        <TaskCard
          task={createTask({ status: "note", dueDate: "2030-01-01" })}
          showDueDate
        />
      </TaskProvider>
    ));
    expect(screen.queryByText(/^Due /i)).not.toBeInTheDocument();
  });

  it("does not render an Eisenhower badge when status is 'note'", () => {
    render(() => (
      <TaskProvider>
        <TaskCard
          task={createTask({
            status: "note",
            importance: "high",
            urgency: "high",
          })}
        />
      </TaskProvider>
    ));
    expect(screen.queryByText("Do First")).not.toBeInTheDocument();
  });

  it("still renders description indicator and duration badge for notes", () => {
    render(() => (
      <TaskProvider>
        <TaskCard
          task={createTask({
            status: "note",
            description: "thoughts",
            scheduledTimes: [
              { id: "s1", start: new Date("2030-01-01T09:00"), duration: 45 },
            ],
          })}
        />
      </TaskProvider>
    ));
    expect(screen.getByLabelText("Has description")).toBeInTheDocument();
    expect(screen.getByText("45m")).toBeInTheDocument();
  });
});
