import { describe, it, expect, beforeEach } from "vitest";
import { createTaskStore } from "./taskStore";

describe("Done-to-Notes conversion (parent subtree)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("dragging a parent subtree from Done back to Notes clears isDone on every descendant", () => {
    // Reproduces the user-reported bug: a parent note dragged to Done becomes
    // an in_progress parent header with isDone=true on its leaves. When the
    // parent is dragged BACK out of Done, the destination panel must clear
    // isDone on every descendant, not just the dragged root, otherwise the
    // leaves remain isDone=true and the Notes filter hides them.
    const [state, actions] = createTaskStore();
    const parentId = actions.addTask("Today's thoughts");
    actions.addTask("Idea 1", parentId);
    actions.addTask("Idea 2", parentId);
    actions.updateTask(parentId, { status: "note" });

    actions.markSubtreeLeavesDone(parentId);
    actions.moveTaskToRootAtIndexWithStatus(parentId, "in_progress", 0);

    const beforeRoot = state.tasks[0];
    expect(beforeRoot.subtasks[0].isDone).toBe(true);
    expect(beforeRoot.subtasks[1].isDone).toBe(true);

    // The action sequence the Notes panel's drop handler should run:
    actions.clearSubtreeIsDone(parentId);
    actions.moveTaskToRootAtIndexWithStatus(parentId, "note", 0);

    const afterRoot = state.tasks[0];
    expect(afterRoot.status).toBe("note");
    expect(afterRoot.subtasks[0].status).toBe("note");
    expect(afterRoot.subtasks[0].isDone).toBeFalsy();
    expect(afterRoot.subtasks[1].isDone).toBeFalsy();
  });
});

describe("Notes-to-Done conversion", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("flips a dropped note's subtree to in_progress and marks every leaf isDone", () => {
    // The action chain the Done column's drop handler runs when receiving a
    // note (or any subtree) from another panel: leaves marked done, then the
    // subtree is rooted with status in_progress.
    const [state, actions] = createTaskStore();
    const rootId = actions.addTask("Top-level note");
    const childId = actions.addTask("Sub-note", rootId);
    actions.addTask("Grandleaf", childId);
    actions.updateTask(rootId, { status: "note" });

    actions.markSubtreeLeavesDone(rootId);
    actions.moveTaskToRootAtIndexWithStatus(rootId, "in_progress", 0);

    const root = state.tasks[0];
    expect(root.id).toBe(rootId);
    expect(root.status).toBe("in_progress");
    expect(root.isDone).toBeFalsy();

    const child = root.subtasks[0];
    expect(child.status).toBe("in_progress");
    expect(child.isDone).toBeFalsy();

    const leaf = child.subtasks[0];
    expect(leaf.status).toBe("in_progress");
    expect(leaf.isDone).toBe(true);
  });
});

describe("Reproduction of Drag-to-Column Bug", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should append task to end of column when status changes, but currently keeps original relative order", () => {
    const [state, actions] = createTaskStore();

    // 1. Setup: Task A (Todo) at index 0, Task B (In Progress) at index 1
    actions.addTask("Task A"); // index 0
    actions.addTask("Task B"); // index 1

    const taskA = state.tasks[0];
    const taskB = state.tasks[1];

    // Set statuses
    actions.updateTask(taskA.id, { status: "todo" });
    actions.updateTask(taskB.id, { status: "in_progress" });

    // Verify initial state
    // Store: [Task A (todo), Task B (in_progress)]
    expect(state.tasks[0].id).toBe(taskA.id);
    expect(state.tasks[1].id).toBe(taskB.id);

    // "In Progress" column should only show Task B
    const inProgressTasksBefore = state.tasks.filter(
      (t) => t.status === "in_progress",
    );
    expect(inProgressTasksBefore.length).toBe(1);
    expect(inProgressTasksBefore[0].id).toBe(taskB.id);

    // 2. Simulate Drag: User drags Task A to "In Progress" column (empty space/container)
    // The current implementation in Dashboard.tsx calls updateTask with new status
    actions.moveTaskToStatus(taskA.id, "in_progress");

    // 3. Expected Behavior (User Intent): Task A should be at the END of "In Progress" column
    // because they dragged it to the column (implied append).

    // 4. Actual Behavior (Bug): Task A remains at index 0 in the store, so it appears BEFORE Task B
    // Store: [Task A (in_progress), Task B (in_progress)]

    const inProgressTasksAfter = state.tasks.filter(
      (t) => t.status === "in_progress",
    );

    // We expect 2 tasks
    expect(inProgressTasksAfter.length).toBe(2);

    // FIXED EXPECTATION: Task A should be appended after Task B
    expect(inProgressTasksAfter[0].id).toBe(taskB.id);
    expect(inProgressTasksAfter[1].id).toBe(taskA.id);
  });
});
