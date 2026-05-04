import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach } from "vitest";
import { type Component } from "solid-js";
import { Inbox } from "./Inbox";
import { TaskProvider, useTaskStore } from "../store/taskStore";

const TestWrapper: Component<{ children: any }> = (props) => {
  return <TaskProvider>{props.children}</TaskProvider>;
};

const InboxProbe: Component<{
  expose: (api: ReturnType<typeof useTaskStore>) => void;
  onOpenTask?: (taskId: string, source?: "add-card") => void;
}> = (props) => {
  const api = useTaskStore();
  props.expose(api);
  return <Inbox onOpenTask={props.onOpenTask} />;
};

describe("Inbox panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a quick-add input with placeholder 'Add a task...'", () => {
    render(() => (
      <TestWrapper>
        <Inbox />
      </TestWrapper>
    ));
    expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument();
  });

  it("creates a status='inbox' root task when the user presses Enter", async () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <InboxProbe expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const input = screen.getByPlaceholderText(
      /add a task/i,
    ) as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Buy Milk" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Buy Milk")).toBeInTheDocument();
    expect(input.value).toBe("");
    const [state] = api!;
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe("inbox");
    expect(state.tasks[0].title).toBe("Buy Milk");
  });

  it("only lists root tasks whose status is 'inbox'", async () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <InboxProbe expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    actions.addTask("An inbox task");
    const noteId = actions.addTask("A note");
    actions.updateTask(noteId, { status: "note" });

    expect(await screen.findByText("An inbox task")).toBeInTheDocument();
    expect(screen.queryByText("A note")).not.toBeInTheDocument();
  });

  it("registers a list-kind drop target with id 'inbox' so cross-panel drags can land on it", () => {
    const { container } = render(() => (
      <TestWrapper>
        <Inbox />
      </TestWrapper>
    ));

    const dropTarget = container.querySelector(
      '[data-drop-kind="list"][data-drop-id="inbox"]',
    );
    expect(dropTarget).not.toBeNull();
  });

  it("renders each task card as a draggable list item with the right drag/drop data attributes", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    const { container } = render(() => (
      <TestWrapper>
        <InboxProbe expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const taskId = actions.addTask("Drag me");

    const item = container.querySelector(
      `[data-drop-id="${taskId}"][data-drop-list="inbox"]`,
    );
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("data-drag-source", "list");
    expect(item).toHaveAttribute("data-drag-list", "inbox");
    expect(item).toHaveAttribute("data-drop-kind", "item");
  });

  it("renders subtasks nested under their parent with depth-based indent metadata", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <InboxProbe expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const parentId = actions.addTask("Top task");
    actions.addTask("Subtask", parentId);

    expect(screen.getByText("Top task")).toBeInTheDocument();
    const subItem = screen.getByText("Subtask").closest("li");
    expect(subItem).not.toBeNull();
    expect(subItem).toHaveAttribute("data-task-depth", "1");
  });

  it("right-click on a task card shows an 'Add subtask' context menu item", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <InboxProbe expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    actions.addTask("Right-click target");

    const card = (
      screen.getByText("Right-click target") as HTMLElement
    ).closest('[data-task-card="true"]') as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.contextMenu(card);

    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Add subtask")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("invokes onOpenTask when a task card is clicked", () => {
    const calls: Array<[string, string?]> = [];
    let api: ReturnType<typeof useTaskStore> | undefined;

    render(() => (
      <TestWrapper>
        <InboxProbe
          expose={(a) => (api = a)}
          onOpenTask={(id, src) => calls.push([id, src])}
        />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const taskId = actions.addTask("Click me");

    const card = screen.getByText("Click me");
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

    expect(calls).toEqual([[taskId, undefined]]);
  });
});
