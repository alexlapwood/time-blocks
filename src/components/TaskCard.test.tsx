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
