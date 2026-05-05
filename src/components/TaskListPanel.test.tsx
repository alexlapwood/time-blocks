import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach } from "vitest";
import { type Component } from "solid-js";
import { TaskListPanel, type TaskListPanelProps } from "./TaskListPanel";
import { TaskProvider, useTaskStore } from "../store/taskStore";
import { __triggerDrop } from "../directives/dnd";

const TestWrapper: Component<{ children: any }> = (props) => {
  return <TaskProvider>{props.children}</TaskProvider>;
};

const Probe: Component<
  TaskListPanelProps & {
    expose: (api: ReturnType<typeof useTaskStore>) => void;
  }
> = (props) => {
  const api = useTaskStore();
  props.expose(api);
  const { expose: _expose, ...panelProps } = props;
  return <TaskListPanel {...panelProps} />;
};

const inboxConfig: TaskListPanelProps = {
  listId: "inbox",
  rootStatus: "inbox",
  heading: "Inbox",
  quickAdd: { kind: "input", placeholder: "Add a task..." },
  contextMenu: {
    addChildLabel: "Add subtask",
    newChildTitle: "New subtask",
  },
};

const notesConfig: TaskListPanelProps = {
  listId: "notes",
  rootStatus: "note",
  heading: "Notes",
  quickAdd: { kind: "input", placeholder: "Add a note..." },
  contextMenu: {
    addChildLabel: "Add sub-note",
    newChildTitle: "New sub-note",
  },
};

const notesButtonConfig: TaskListPanelProps = {
  listId: "notes",
  rootStatus: "note",
  heading: "Notes",
  quickAdd: { kind: "button", label: "Add a note", newTaskTitle: "New note" },
  contextMenu: {
    addChildLabel: "Add sub-note",
    newChildTitle: "New sub-note",
  },
};

describe("TaskListPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the configured input placeholder", () => {
    render(() => (
      <TestWrapper>
        <TaskListPanel {...inboxConfig} />
      </TestWrapper>
    ));

    expect(screen.getByPlaceholderText("Add a task...")).toBeInTheDocument();
  });

  it("creates a root task with the configured rootStatus when Enter is pressed", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <Probe {...notesConfig} expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const input = screen.getByPlaceholderText(
      "Add a note...",
    ) as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Random thought" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const [state] = api!;
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe("note");
    expect(state.tasks[0].title).toBe("Random thought");
    expect(input.value).toBe("");
  });

  it("only lists root tasks whose status matches rootStatus", async () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <Probe {...notesConfig} expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    actions.addTask("Inbox-only");
    const noteId = actions.addTask("A note");
    actions.updateTask(noteId, { status: "note" });

    expect(await screen.findByText("A note")).toBeInTheDocument();
    expect(screen.queryByText("Inbox-only")).not.toBeInTheDocument();
  });

  it("registers a list-kind drop target with the configured listId", () => {
    const { container } = render(() => (
      <TestWrapper>
        <TaskListPanel {...notesConfig} />
      </TestWrapper>
    ));

    const dropTarget = container.querySelector(
      '[data-drop-kind="list"][data-drop-id="notes"]',
    );
    expect(dropTarget).not.toBeNull();
  });

  it("renders each task card as a draggable list item with the right drag/drop data attributes", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    const { container } = render(() => (
      <TestWrapper>
        <Probe {...notesConfig} expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const noteId = actions.addTask("Drag me");
    actions.updateTask(noteId, { status: "note" });

    const item = container.querySelector(
      `[data-drop-id="${noteId}"][data-drop-list="notes"]`,
    );
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("data-drag-source", "list");
    expect(item).toHaveAttribute("data-drag-list", "notes");
    expect(item).toHaveAttribute("data-drop-kind", "item");
  });

  it("renders nested children with depth-based indent metadata", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <Probe {...notesConfig} expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const parentId = actions.addTask("Top note");
    actions.updateTask(parentId, { status: "note" });
    actions.addTask("Sub note", parentId);

    expect(screen.getByText("Top note")).toBeInTheDocument();
    const subItem = screen.getByText("Sub note").closest("li");
    expect(subItem).not.toBeNull();
    expect(subItem).toHaveAttribute("data-task-depth", "1");
  });

  it("right-click on a card shows the configured addChildLabel in the context menu", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <Probe {...notesConfig} expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const noteId = actions.addTask("Right-click target");
    actions.updateTask(noteId, { status: "note" });

    const card = (
      screen.getByText("Right-click target") as HTMLElement
    ).closest('[data-task-card="true"]') as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.contextMenu(card);

    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Add sub-note")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders an add button (not an input) when quickAdd.kind is 'button'", () => {
    render(() => (
      <TestWrapper>
        <TaskListPanel {...notesButtonConfig} />
      </TestWrapper>
    ));

    expect(
      screen.getByRole("button", { name: /add a note/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/add a note/i),
    ).not.toBeInTheDocument();
  });

  it("renders the add button below the task list when quickAdd.kind is 'button'", () => {
    const { container } = render(() => (
      <TestWrapper>
        <TaskListPanel {...notesButtonConfig} />
      </TestWrapper>
    ));

    const button = screen.getByRole("button", { name: /add a note/i });
    const list = container.querySelector("ul");
    expect(list).not.toBeNull();

    const buttonFollowsList = !!(
      list!.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(buttonFollowsList).toBe(true);
  });

  it("renders the input above the task list when quickAdd.kind is 'input'", () => {
    const { container } = render(() => (
      <TestWrapper>
        <TaskListPanel {...inboxConfig} />
      </TestWrapper>
    ));

    const input = screen.getByPlaceholderText(/add a task/i);
    const list = container.querySelector("ul");
    expect(list).not.toBeNull();

    const inputPrecedesList = !!(
      list!.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING
    );
    expect(inputPrecedesList).toBe(true);
  });

  it("clicking the add button creates a root task with the configured rootStatus and opens it as an add-card", () => {
    const calls: Array<[string, string?]> = [];
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <Probe
          {...notesButtonConfig}
          expose={(a) => (api = a)}
          onOpenTask={(id, src) => calls.push([id, src])}
        />
      </TestWrapper>
    ));

    fireEvent.click(screen.getByRole("button", { name: /add a note/i }));

    const [state] = api!;
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe("note");
    expect(state.tasks[0].title).toBe("New note");
    expect(calls).toEqual([[state.tasks[0].id, "add-card"]]);
  });

  it("dropping a task at root rewrites the dropped subtree's status to rootStatus", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    const { container } = render(() => (
      <TestWrapper>
        <Probe {...notesConfig} expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [state, actions] = api!;
    const droppedId = actions.addTask("In the wrong list");
    expect(state.tasks[0].status).toBe("inbox");

    const dropTarget = container.querySelector(
      '[data-drop-kind="list"][data-drop-id="notes"]',
    ) as HTMLElement;
    expect(dropTarget).not.toBeNull();

    __triggerDrop(dropTarget, droppedId, {
      kind: "list",
      listId: "notes",
      itemId: null,
      placement: "end",
      depth: 0,
    });

    const moved = state.tasks.find((t) => t.id === droppedId);
    expect(moved?.status).toBe("note");
  });
});
