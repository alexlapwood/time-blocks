import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { TaskCard } from "./TaskCard";
import { type Task } from "../store/taskStore";

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
    render(() => <TaskCard task={createTask({ description: "Has notes" })} />);

    const indicator = screen.getByLabelText("Has description");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("role", "img");
    expect(indicator).not.toHaveClass("badge");
  });

  it("does not show a description icon indicator for empty notes", () => {
    render(() => <TaskCard task={createTask({ description: "   " })} />);
    expect(screen.queryByLabelText("Has description")).not.toBeInTheDocument();
  });
});
