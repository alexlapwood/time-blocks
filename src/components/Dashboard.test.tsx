import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach } from "vitest";
import { Dashboard } from "./Dashboard";
import { TaskProvider } from "../store/taskStore";
import { type Component } from "solid-js";

const TestWrapper: Component<{ children: any }> = (props) => {
  return <TaskProvider>{props.children}</TaskProvider>;
};

const readStoredTasks = () => {
  const raw = localStorage.getItem("timeblocks-tasks");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { tasks?: Array<{ title: string }> };
  return Array.isArray(parsed.tasks) ? parsed.tasks : [];
};

const seedStoredTasks = (tasks: Array<Record<string, unknown>>) => {
  localStorage.setItem("timeblocks-tasks", JSON.stringify({ tasks }));
};

describe("Dashboard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should render toggles", () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));
    expect(screen.getByRole("heading", { name: /Inbox/i })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notes" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Calendar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument();
  });

  it("should toggle views", () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    // Initially Inbox and Board are visible (based on default state in Dashboard.tsx)
    // Calendar is hidden.

    // We can't easily check visibility of "Show" content unless we look for specific elements inside.
    // Inbox has "Inbox" heading.
    // Board has "TODO" column heading.

    expect(screen.getByRole("heading", { name: /Inbox/i })).toBeVisible();

    // Toggle Inbox off
    const inboxBtn = screen.getByRole("button", { name: "Inbox" });
    fireEvent.click(inboxBtn);

    expect(inboxBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("should delete a new add-card task when cancelling", async () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    fireEvent.click(screen.getAllByRole("button", { name: /add a task/i })[0]);
    expect(readStoredTasks()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()).toHaveLength(0);
    });
  });

  it("should keep a new add-card task when closing", async () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    fireEvent.click(screen.getAllByRole("button", { name: /add a task/i })[0]);
    expect(readStoredTasks()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()).toHaveLength(1);
    });
  });

  it("should keep a new add-card task when pressing Enter in title", async () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    fireEvent.click(screen.getAllByRole("button", { name: /add a task/i })[0]);
    const titleInput = await screen.findByLabelText("Title");
    fireEvent.input(titleInput, { target: { value: "Plan sprint retro" } });
    expect(readStoredTasks()[0]?.title).toBe("Plan sprint retro");

    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()).toHaveLength(1);
      expect(readStoredTasks()[0]?.title).toBe("Plan sprint retro");
    });
  });

  it("should save a new add-card task when clicking outside", async () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    fireEvent.click(screen.getAllByRole("button", { name: /add a task/i })[0]);
    expect(readStoredTasks()).toHaveLength(1);

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()).toHaveLength(1);
    });
  });

  it("should keep edits when closing an existing task modal", async () => {
    seedStoredTasks([
      {
        id: "task-1",
        title: "Write report",
        status: "todo",
        description: "",
        dueDate: null,
        category: null,
        importance: "none",
        urgency: "none",
        subtasks: [],
        scheduledTimes: [],
      },
    ]);

    render(() => (
      <TestWrapper>
        <Dashboard initialTaskId="task-1" initialTaskSource="existing-task" />
      </TestWrapper>
    ));

    const titleInput = await screen.findByLabelText("Title");
    fireEvent.input(titleInput, { target: { value: "Changed title" } });
    expect(readStoredTasks()[0]?.title).toBe("Changed title");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()[0]?.title).toBe("Changed title");
    });
  });

  it("should keep edits when pressing Enter in existing task title", async () => {
    seedStoredTasks([
      {
        id: "task-1",
        title: "Write report",
        status: "todo",
        description: "",
        dueDate: null,
        category: null,
        importance: "none",
        urgency: "none",
        subtasks: [],
        scheduledTimes: [],
      },
    ]);

    render(() => (
      <TestWrapper>
        <Dashboard initialTaskId="task-1" initialTaskSource="existing-task" />
      </TestWrapper>
    ));

    const titleInput = await screen.findByLabelText("Title");
    fireEvent.input(titleInput, { target: { value: "Changed title" } });
    expect(readStoredTasks()[0]?.title).toBe("Changed title");

    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()[0]?.title).toBe("Changed title");
    });
  });

  it("should keep edits when clicking outside an existing task modal", async () => {
    seedStoredTasks([
      {
        id: "task-1",
        title: "Write report",
        status: "todo",
        description: "",
        dueDate: null,
        category: null,
        importance: "none",
        urgency: "none",
        subtasks: [],
        scheduledTimes: [],
      },
    ]);

    render(() => (
      <TestWrapper>
        <Dashboard initialTaskId="task-1" initialTaskSource="existing-task" />
      </TestWrapper>
    ));

    const titleInput = await screen.findByLabelText("Title");
    fireEvent.input(titleInput, { target: { value: "Changed title" } });
    expect(readStoredTasks()[0]?.title).toBe("Changed title");

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(readStoredTasks()[0]?.title).toBe("Changed title");
    });
  });
});
