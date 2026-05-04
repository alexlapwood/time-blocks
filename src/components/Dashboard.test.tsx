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

  it("centers the dashboard within a max width", () => {
    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    const dashboardRoot = screen.getByRole("banner")
      .parentElement as HTMLElement;
    expect(dashboardRoot).toHaveClass("mx-auto");
    expect(dashboardRoot).toHaveClass("max-w-(--dashboard-max-width)");
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

  it("renders a Done parent header as a draggable item so it can be moved as a unit", async () => {
    seedStoredTasks([
      {
        id: "parent-1",
        title: "Today's thoughts",
        status: "in_progress",
        description: "",
        dueDate: null,
        category: null,
        importance: "none",
        urgency: "none",
        subtasks: [
          {
            id: "child-1",
            title: "Idea 1",
            status: "in_progress",
            isDone: true,
            subtasks: [],
            scheduledTimes: [],
          },
          {
            id: "child-2",
            title: "Idea 2",
            status: "in_progress",
            isDone: true,
            subtasks: [],
            scheduledTimes: [],
          },
        ],
        scheduledTimes: [],
      },
    ]);

    render(() => (
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    ));

    const header = (await screen.findByText("Today's thoughts")).closest(
      "[data-drop-id='parent-1']",
    ) as HTMLElement | null;
    expect(header).not.toBeNull();
    expect(header).toHaveAttribute("data-drag-source", "list");
    expect(header).toHaveAttribute("data-drag-list", "done");
  });

  it("clicks a note card open and shows the note editor copy", async () => {
    seedStoredTasks([
      {
        id: "note-1",
        title: "Pick up bread",
        status: "note",
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
        <Dashboard />
      </TestWrapper>
    ));

    const card = (await screen.findByText("Pick up bread")).closest(
      '[data-task-card="true"]',
    ) as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.pointerDown(card, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(card, {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });

    expect(await screen.findByText("Edit note")).toBeInTheDocument();
    expect(screen.getByText("Note details")).toBeInTheDocument();
  });

  it("renders note copy in the editor when an active note task is opened", async () => {
    seedStoredTasks([
      {
        id: "note-1",
        title: "A thought",
        status: "note",
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
        <Dashboard initialTaskId="note-1" initialTaskSource="existing-task" />
      </TestWrapper>
    ));

    expect(await screen.findByText("Edit note")).toBeInTheDocument();
    expect(screen.getByText("Note details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete note" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/due date/i)).not.toBeInTheDocument();
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
