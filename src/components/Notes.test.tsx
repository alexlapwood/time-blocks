import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach } from "vitest";
import { type Component } from "solid-js";
import { Notes } from "./Notes";
import { TaskProvider, useTaskStore } from "../store/taskStore";

const TestWrapper: Component<{ children: any }> = (props) => {
  return <TaskProvider>{props.children}</TaskProvider>;
};

const NotesProbe: Component<{
  expose: (api: ReturnType<typeof useTaskStore>) => void;
  onOpenTask?: (taskId: string, source?: "add-card") => void;
}> = (props) => {
  const api = useTaskStore();
  props.expose(api);
  return <Notes onOpenTask={props.onOpenTask} />;
};

describe("Notes panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders an 'Add a note' button instead of a quick-add input", () => {
    render(() => (
      <TestWrapper>
        <Notes />
      </TestWrapper>
    ));
    expect(
      screen.getByRole("button", { name: /add a note/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/add a note/i),
    ).not.toBeInTheDocument();
  });

  it("creates a status='note' root task and opens it as a new card when the button is clicked", () => {
    const calls: Array<[string, string?]> = [];
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <NotesProbe
          expose={(a) => (api = a)}
          onOpenTask={(id, src) => calls.push([id, src])}
        />
      </TestWrapper>
    ));

    const button = screen.getByRole("button", { name: /add a note/i });
    fireEvent.click(button);

    const [state] = api!;
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe("note");
    expect(state.tasks[0].title).toBe("New note");
    expect(calls).toEqual([[state.tasks[0].id, "add-card"]]);
  });

  it("only lists root tasks whose status is 'note'", async () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <NotesProbe expose={(a) => (api = a)} />
      </TestWrapper>
    ));

    const [, actions] = api!;
    actions.addTask("Inbox-only");
    const noteId = actions.addTask("A note");
    actions.updateTask(noteId, { status: "note" });

    expect(await screen.findByText("A note")).toBeInTheDocument();
    expect(screen.queryByText("Inbox-only")).not.toBeInTheDocument();
  });

  it("registers a list-kind drop target with id 'notes' so cross-panel drags can land on it", () => {
    const { container } = render(() => (
      <TestWrapper>
        <Notes />
      </TestWrapper>
    ));

    const dropTarget = container.querySelector(
      '[data-drop-kind="list"][data-drop-id="notes"]',
    );
    expect(dropTarget).not.toBeNull();
  });

  it("renders each note card as a draggable list item with the right drag/drop data attributes", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    const { container } = render(() => (
      <TestWrapper>
        <NotesProbe expose={(a) => (api = a)} />
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

  it("renders sub-notes nested under their parent with depth-based indent metadata", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;
    render(() => (
      <TestWrapper>
        <NotesProbe expose={(a) => (api = a)} />
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

  it("right-click on a note card shows an 'Add sub-note' context menu item", () => {
    let api: ReturnType<typeof useTaskStore> | undefined;

    render(() => (
      <TestWrapper>
        <NotesProbe expose={(a) => (api = a)} />
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

  it("invokes onOpenTask when a note card is clicked", () => {
    const calls: Array<[string, string?]> = [];
    let api: ReturnType<typeof useTaskStore> | undefined;

    render(() => (
      <TestWrapper>
        <NotesProbe
          expose={(a) => (api = a)}
          onOpenTask={(id, src) => calls.push([id, src])}
        />
      </TestWrapper>
    ));

    const [, actions] = api!;
    const noteId = actions.addTask("Click me");
    actions.updateTask(noteId, { status: "note" });

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

    expect(calls).toEqual([[noteId, undefined]]);
  });
});
