import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTaskStore,
  getEffectiveCategory,
  setSubtreeStatus,
  type Task,
} from "./taskStore";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title: "task",
  status: "inbox",
  subtasks: [],
  scheduledTimes: [],
  ...overrides,
});

describe("taskStore", () => {
  // Reset local storage before each test
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should initialize with empty tasks", () => {
    const [state] = createTaskStore();
    expect(state.tasks).toEqual([]);
  });

  it("should migrate legacy medium priority values to low", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "legacy-priority-task",
            title: "Legacy priority",
            status: "todo",
            importance: "medium",
            urgency: "medium",
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].importance).toBe("low");
    expect(state.tasks[0].urgency).toBe("low");
  });

  it("should add a task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("New Task");
    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].title).toBe("New Task");
    expect(state.tasks[0].status).toBe("inbox");
    expect(state.tasks[0].scheduledTimes.length).toBe(0);
  });

  it("should return the new task ID when adding a task", () => {
    const [state, actions] = createTaskStore();
    const id = actions.addTask("New Task");
    expect(typeof id).toBe("string");
    expect(id).toBe(state.tasks[0].id);
  });

  it("should return the new subtask ID when adding a subtask", () => {
    const [state, actions] = createTaskStore();
    const parentId = actions.addTask("Parent");
    const childId = actions.addTask("Child", parentId);
    expect(typeof childId).toBe("string");
    expect(childId).toBe(state.tasks[0].subtasks[0].id);
  });

  it("addTask under a non-inbox parent inherits the parent's status (subtree invariant)", () => {
    const [state, actions] = createTaskStore();
    const parentId = actions.addTask("Note parent");
    actions.updateTask(parentId, { status: "note" });

    const childId = actions.addTask("Child", parentId);

    const parent = state.tasks.find((t) => t.id === parentId)!;
    const child = parent.subtasks.find((t) => t.id === childId)!;
    expect(child.status).toBe("note");
  });

  it("should update a task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task 1");
    const taskId = state.tasks[0].id;
    actions.updateTask(taskId, { status: "todo" });
    expect(state.tasks[0].status).toBe("todo");
  });

  it("should delete a task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task 1");
    const taskId = state.tasks[0].id;
    actions.deleteTask(taskId);
    expect(state.tasks.length).toBe(0);
  });

  it("should move a task (reparenting)", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    actions.addTask("Child");
    const parentId = state.tasks[0].id;
    const childId = state.tasks[1].id;

    actions.moveTask(childId, parentId);

    // Check if child is removed from root
    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].id).toBe(parentId);

    // Check if child is added to parent's subtasks
    expect(state.tasks[0].subtasks).toBeDefined();
    expect(state.tasks[0].subtasks.length).toBe(1);
    expect(state.tasks[0].subtasks[0].id).toBe(childId);
    expect(state.tasks[0].subtasks[0].parentId).toBe(parentId);
  });

  it("should persist to localStorage", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const [_, actions] = createTaskStore();
    actions.addTask("Persisted Task");
    expect(setItemSpy).toHaveBeenCalled();
  });

  it("should reorder task within same list (move down)", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task 1");
    actions.addTask("Task 2");
    actions.addTask("Task 3");

    // Initial order: Task 1, Task 2, Task 3
    const id1 = state.tasks[0].id;
    const id2 = state.tasks[1].id;
    const id3 = state.tasks[2].id;

    // Move Task 1 to before Task 3 (index 2)
    // Effectively moving it to index 1 (after Task 2)
    // Our moveTaskBefore logic: targetId is id3.
    actions.moveTaskBefore(id1, id3);

    // Expected order: Task 2, Task 1, Task 3
    // Wait, the indices shifted.
    // Initial: [id1, id2, id3]
    // Target is id3 (index 2).
    // Remove id1 (index 0) -> [id2, id3].
    // Insert id1 at index 2 -> [id2, id3, id1].
    // So result is [id2, id3, id1].
    // My manual trace earlier: "Insert at target index". Target index was 2.
    // Result is [id2, id3, id1].
    // Wait, if I drag id1 to id3, I want it BEFORE id3?
    // If dragging DOWN, insert AFTER? No, our logic says "Insert at target index".
    // Since we removed item *before* target, target shifted left (index 2 -> index 1).
    // Original index 2 is now "After target".
    // So insertion at 2 puts it after target. [id2, id3, id1].

    expect(state.tasks[0].id).toBe(id2);
    expect(state.tasks[1].id).toBe(id3);
    expect(state.tasks[2].id).toBe(id1);
  });

  it("should reorder task within same list (move up)", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task 1");
    actions.addTask("Task 2");
    actions.addTask("Task 3");

    const id1 = state.tasks[0].id;
    const id2 = state.tasks[1].id;
    const id3 = state.tasks[2].id;

    // Move Task 3 to before Task 1 (index 0)
    actions.moveTaskBefore(id3, id1);

    // Expected order: Task 3, Task 1, Task 2
    expect(state.tasks[0].id).toBe(id3);
    expect(state.tasks[1].id).toBe(id1);
    expect(state.tasks[2].id).toBe(id2);
  });

  it("should move task to different list and update status", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Inbox Task");
    actions.addTask("Todo Task");

    const inboxId = state.tasks[0].id;
    const todoId = state.tasks[1].id;

    // Set status manually first to simulate different columns
    actions.updateTask(todoId, { status: "todo" });

    expect(state.tasks[0].status).toBe("inbox");
    expect(state.tasks[1].status).toBe("todo");

    // Move Inbox Task onto Todo Task (should adopt todo status)
    actions.moveTaskBefore(inboxId, todoId);

    // Order: Inbox Task (now todo), Todo Task
    // Initial: [InboxTask (0), TodoTask (1)]
    // Target: TodoTask (1).
    // Remove InboxTask (0) -> [TodoTask (0)].
    // Insert InboxTask at 1 -> [TodoTask, InboxTask].
    // Wait, order changed!
    // My previous assumption was "insert at 0".
    // But `moveTaskBefore` uses `targetIndex` from original array. Target was 1.
    // So it inserts at 1. Result [TodoTask, InboxTask].

    // Check order swapped
    expect(state.tasks[0].id).toBe(todoId);

    // Check status updated on the moved task
    expect(state.tasks[1].id).toBe(inboxId);
    expect(state.tasks[1].status).toBe("todo");
  });

  it("should get task context correctly", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Root Task");
    const rootId = state.tasks[0].id;

    const context = actions.getTaskContext(rootId);
    expect(context).not.toBeNull();
    expect(context?.task.id).toBe(rootId);
    expect(context?.index).toBe(0);
    // context?.parentArray is state.tasks, hard to assert equality with proxy, but check length
    expect(context?.parentArray.length).toBe(1);
  });

  it("should resolve overlaps when resizing a scheduled task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task A");
    actions.addTask("Task B");

    const taskA = state.tasks[0];
    const taskB = state.tasks[1];

    actions.updateTask(taskA.id, { status: "todo" });
    actions.updateTask(taskB.id, { status: "todo" });

    actions.addScheduledSlot(taskA.id, new Date("2025-01-01T09:00:00"), 30);
    actions.addScheduledSlot(taskB.id, new Date("2025-01-01T09:30:00"), 30);

    const slotA = taskA.scheduledTimes[0];
    actions.updateScheduledSlotDuration(slotA.id, 60);

    const updatedB = state.tasks.find((t) => t.id === taskB.id)!;
    const updatedSlotB = updatedB.scheduledTimes[0];
    const updatedTime = new Date(updatedSlotB.start as Date | string);
    expect(updatedTime.getHours()).toBe(10);
    expect(updatedTime.getMinutes()).toBe(0);
  });

  it("should initialize with empty calendar draft slots", () => {
    const [state] = createTaskStore();
    expect(state.calendarDraftSlots).toEqual([]);
  });

  it("should toggle isDone on a leaf task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Leaf Task");
    const taskId = state.tasks[0].id;

    expect(state.tasks[0].isDone).toBeFalsy();

    actions.toggleDone(taskId);
    expect(state.tasks[0].isDone).toBe(true);

    actions.toggleDone(taskId);
    expect(state.tasks[0].isDone).toBe(false);
  });

  it("should not toggle isDone on a task with subtasks", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    const parentId = state.tasks[0].id;
    actions.addTask("Child", parentId);

    actions.toggleDone(parentId);
    expect(state.tasks[0].isDone).toBeFalsy();
  });

  it("should toggle isDone on a nested subtask", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    const parentId = state.tasks[0].id;
    actions.addTask("Child", parentId);
    const childId = state.tasks[0].subtasks[0].id;

    actions.toggleDone(childId);
    expect(state.tasks[0].subtasks[0].isDone).toBe(true);
  });

  it("should preserve status when toggling isDone", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;
    actions.updateTask(taskId, { status: "in_progress" });

    actions.toggleDone(taskId);
    expect(state.tasks[0].isDone).toBe(true);
    expect(state.tasks[0].status).toBe("in_progress");

    actions.toggleDone(taskId);
    expect(state.tasks[0].isDone).toBe(false);
    expect(state.tasks[0].status).toBe("in_progress");
  });

  it("should preserve status='note' from stored data", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "note-task",
            title: "A note",
            status: "note",
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].status).toBe("note");
  });

  it("should migrate legacy done status to isDone flag", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "done-task",
            title: "Completed",
            status: "done",
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].isDone).toBe(true);
    expect(state.tasks[0].status).toBe("in_progress");
  });

  it("should not set isDone when migrating done status on task with subtasks", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "done-parent",
            title: "Parent",
            status: "done",
            subtasks: [
              {
                id: "child",
                title: "Child",
                status: "todo",
                subtasks: [],
                scheduledTimes: [],
              },
            ],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].isDone).toBeFalsy();
    expect(state.tasks[0].status).toBe("in_progress");
  });

  it("should normalize isDone from stored data", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "stored-done",
            title: "Done task",
            status: "todo",
            isDone: true,
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].isDone).toBe(true);
    expect(state.tasks[0].status).toBe("todo");
  });

  it("should set completedAt when toggling done to true", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;

    const before = new Date().toISOString();
    actions.toggleDone(taskId);
    const after = new Date().toISOString();

    expect(state.tasks[0].isDone).toBe(true);
    expect(state.tasks[0].completedAt).toBeDefined();
    expect(state.tasks[0].completedAt! >= before).toBe(true);
    expect(state.tasks[0].completedAt! <= after).toBe(true);
  });

  it("should clear completedAt when toggling done to false", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;

    actions.toggleDone(taskId);
    expect(state.tasks[0].completedAt).toBeDefined();

    actions.toggleDone(taskId);
    expect(state.tasks[0].isDone).toBe(false);
    expect(state.tasks[0].completedAt).toBeUndefined();
  });

  it("should set completedAt when updateTask sets isDone to true", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;

    actions.updateTask(taskId, { isDone: true });
    expect(state.tasks[0].completedAt).toBeDefined();
  });

  it("should clear completedAt when updateTask sets isDone to false", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;

    actions.updateTask(taskId, { isDone: true });
    expect(state.tasks[0].completedAt).toBeDefined();

    actions.updateTask(taskId, { isDone: false });
    expect(state.tasks[0].completedAt).toBeUndefined();
  });

  it("should archive a task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;

    actions.archiveTask(taskId);
    expect(state.tasks[0].isArchived).toBe(true);
  });

  it("should unarchive a task", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Task");
    const taskId = state.tasks[0].id;

    actions.archiveTask(taskId);
    expect(state.tasks[0].isArchived).toBe(true);

    actions.unarchiveTask(taskId);
    expect(state.tasks[0].isArchived).toBe(false);
  });

  it("should unarchive all descendants when unarchiving a parent", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    const parentId = state.tasks[0].id;
    actions.addTask("Child", parentId);
    const childId = state.tasks[0].subtasks[0].id;
    actions.addTask("Grandchild", childId);

    actions.archiveTask(parentId);
    actions.archiveTask(childId);
    actions.archiveTask(state.tasks[0].subtasks[0].subtasks[0].id);

    actions.unarchiveTask(parentId);
    expect(state.tasks[0].isArchived).toBe(false);
    expect(state.tasks[0].subtasks[0].isArchived).toBe(false);
    expect(state.tasks[0].subtasks[0].subtasks[0].isArchived).toBe(false);
  });

  it("should archive all effectively done root tasks", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Done Task");
    actions.addTask("Not Done Task");

    const doneId = state.tasks[0].id;
    actions.toggleDone(doneId);

    actions.archiveDoneTasks();

    expect(state.tasks.find((t) => t.id === doneId)?.isArchived).toBe(true);
    expect(state.tasks[1].isArchived).toBeFalsy();
  });

  it("should archive parent when all subtasks are effectively done", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    const parentId = state.tasks[0].id;
    actions.addTask("Child", parentId);
    const childId = state.tasks[0].subtasks[0].id;

    actions.toggleDone(childId);
    actions.archiveDoneTasks();

    expect(state.tasks[0].isArchived).toBe(true);
  });

  it("should not archive parent when not all subtasks are done", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    const parentId = state.tasks[0].id;
    actions.addTask("Child A", parentId);
    actions.addTask("Child B", parentId);
    const childAId = state.tasks[0].subtasks[0].id;

    actions.toggleDone(childAId);
    actions.archiveDoneTasks();

    expect(state.tasks[0].isArchived).toBeFalsy();
  });

  it("should archive done subtask even when sibling is not done", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Parent");
    const parentId = state.tasks[0].id;
    actions.addTask("Child A", parentId);
    actions.addTask("Child B", parentId);
    const childAId = state.tasks[0].subtasks[0].id;

    actions.toggleDone(childAId);
    actions.archiveDoneTasks();

    expect(state.tasks[0].isArchived).toBeFalsy();
    expect(state.tasks[0].subtasks[0].isArchived).toBe(true);
    expect(state.tasks[0].subtasks[1].isArchived).toBeFalsy();
  });

  it("should normalize completedAt and isArchived from stored data", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "archived-task",
            title: "Archived",
            status: "todo",
            isDone: true,
            completedAt: "2026-02-28T12:00:00.000Z",
            isArchived: true,
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].completedAt).toBe("2026-02-28T12:00:00.000Z");
    expect(state.tasks[0].isArchived).toBe(true);
  });

  it("should backfill completedAt for done tasks without one", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "legacy-done",
            title: "Legacy done",
            status: "todo",
            isDone: true,
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const before = new Date().toISOString();
    const [state] = createTaskStore();
    const after = new Date().toISOString();

    expect(state.tasks[0].isDone).toBe(true);
    expect(state.tasks[0].completedAt).toBeDefined();
    expect(state.tasks[0].completedAt! >= before).toBe(true);
    expect(state.tasks[0].completedAt! <= after).toBe(true);
  });

  it("should not backfill completedAt for non-done tasks", () => {
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "not-done",
            title: "Not done",
            status: "todo",
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );

    const [state] = createTaskStore();
    expect(state.tasks[0].isDone).toBeFalsy();
    expect(state.tasks[0].completedAt).toBeUndefined();
  });

  it("moveTaskToRootAtIndexWithStatus rewrites descendants' status to match", () => {
    const [state, actions] = createTaskStore();
    const parentId = actions.addTask("Parent");
    actions.addTask("Child", parentId);
    actions.addTask("Grandchild", state.tasks[0].subtasks[0].id);

    actions.moveTaskToRootAtIndexWithStatus(parentId, "note", 0);

    expect(state.tasks[0].status).toBe("note");
    expect(state.tasks[0].subtasks[0].status).toBe("note");
    expect(state.tasks[0].subtasks[0].subtasks[0].status).toBe("note");
  });

  it("moveTaskToStatusAtIndex rewrites descendants' status to match", () => {
    const [state, actions] = createTaskStore();
    const parentId = actions.addTask("Parent");
    actions.addTask("Child", parentId);

    actions.moveTaskToStatusAtIndex(parentId, "todo", 0);

    expect(state.tasks[0].status).toBe("todo");
    expect(state.tasks[0].subtasks[0].status).toBe("todo");
  });

  it("moveSubtaskToIndex rewrites the moved subtree to the new parent's status", () => {
    const [state, actions] = createTaskStore();
    const inboxParentId = actions.addTask("Inbox parent");
    const movingId = actions.addTask("Moving", inboxParentId);
    actions.addTask("Grandchild", movingId);
    const noteParentId = actions.addTask("Note parent");
    actions.moveTaskToStatusAtIndex(noteParentId, "note", 0);

    actions.moveSubtaskToIndex(movingId, noteParentId, 0);

    const noteParent = state.tasks.find((t) => t.id === noteParentId);
    expect(noteParent?.subtasks[0].id).toBe(movingId);
    expect(noteParent?.subtasks[0].status).toBe("note");
    expect(noteParent?.subtasks[0].subtasks[0].status).toBe("note");
  });

  describe("clearSubtreeIsDone", () => {
    it("resets isDone on a single leaf", () => {
      const [state, actions] = createTaskStore();
      const id = actions.addTask("Leaf");
      actions.toggleDone(id);
      expect(state.tasks[0].isDone).toBe(true);

      actions.clearSubtreeIsDone(id);

      expect(state.tasks[0].isDone).toBeFalsy();
      expect(state.tasks[0].completedAt).toBeUndefined();
    });

    it("resets isDone on every node in a deeply nested subtree", () => {
      const [state, actions] = createTaskStore();
      const rootId = actions.addTask("Root");
      const childId = actions.addTask("Child", rootId);
      actions.addTask("Grandleaf", childId);
      actions.markSubtreeLeavesDone(rootId);

      actions.clearSubtreeIsDone(rootId);

      const root = state.tasks[0];
      const child = root.subtasks[0];
      const grandLeaf = child.subtasks[0];
      expect(grandLeaf.isDone).toBeFalsy();
      expect(grandLeaf.completedAt).toBeUndefined();
    });

    it("is idempotent on subtrees with no done items", () => {
      const [state, actions] = createTaskStore();
      const rootId = actions.addTask("Root");
      actions.addTask("Child", rootId);

      actions.clearSubtreeIsDone(rootId);

      const root = state.tasks[0];
      expect(root.isDone).toBeFalsy();
      expect(root.subtasks[0].isDone).toBeFalsy();
    });
  });

  describe("markSubtreeLeavesDone", () => {
    it("marks a leaf task as done", () => {
      const [state, actions] = createTaskStore();
      const id = actions.addTask("Leaf");

      actions.markSubtreeLeavesDone(id);

      expect(state.tasks[0].isDone).toBe(true);
    });

    it("marks every leaf in a deeply nested subtree but leaves parents un-done", () => {
      const [state, actions] = createTaskStore();
      const rootId = actions.addTask("Root");
      const childId = actions.addTask("Child", rootId);
      actions.addTask("Grandleaf", childId);
      actions.addTask("Sibling leaf", rootId);

      actions.markSubtreeLeavesDone(rootId);

      const root = state.tasks[0];
      expect(root.isDone).toBeFalsy();
      const child = root.subtasks.find((t) => t.id === childId)!;
      expect(child.isDone).toBeFalsy();
      const grandLeaf = child.subtasks[0];
      expect(grandLeaf.isDone).toBe(true);
      const siblingLeaf = root.subtasks[1];
      expect(siblingLeaf.isDone).toBe(true);
    });

    it("is idempotent for already-done leaves", () => {
      const [state, actions] = createTaskStore();
      const id = actions.addTask("Leaf");
      actions.toggleDone(id);
      const firstCompletedAt = state.tasks[0].completedAt;

      actions.markSubtreeLeavesDone(id);

      expect(state.tasks[0].isDone).toBe(true);
      expect(state.tasks[0].completedAt).toBe(firstCompletedAt);
    });
  });

  it("moveTaskBefore rewrites the moved subtree's descendants when statuses differ", () => {
    const [state, actions] = createTaskStore();
    const aId = actions.addTask("A");
    actions.addTask("Child", aId);
    const bId = actions.addTask("B");
    actions.moveTaskToStatusAtIndex(bId, "note", 0);

    actions.moveTaskBefore(aId, bId);

    const movedA = state.tasks.find((t) => t.id === aId);
    expect(movedA?.status).toBe("note");
    expect(movedA?.subtasks[0].status).toBe("note");
  });

  it("should move a subtask to root at a specific index", () => {
    const [state, actions] = createTaskStore();
    actions.addTask("Root A");
    actions.addTask("Root B");
    const rootAId = state.tasks[0].id;
    const rootBId = state.tasks[1].id;
    actions.addTask("Child", rootAId);
    const childId = state.tasks[0].subtasks[0].id;

    actions.moveTaskToRootAtIndex(childId, 1);

    expect(state.tasks.length).toBe(3);
    expect(state.tasks[0].id).toBe(rootAId);
    expect(state.tasks[1].id).toBe(childId);
    expect(state.tasks[2].id).toBe(rootBId);
    expect(state.tasks[1].parentId).toBeUndefined();
    expect(state.tasks[0].subtasks.length).toBe(0);
  });

  describe("getEffectiveCategory", () => {
    it("should return the task's own category when set", () => {
      const [state, actions] = createTaskStore();
      const id = actions.addTask("Task");
      actions.updateTask(id, { category: "blue" });
      expect(getEffectiveCategory(state.tasks, state.tasks[0])).toBe("blue");
    });

    it("should return null for a root task with no category", () => {
      const [state, actions] = createTaskStore();
      actions.addTask("Task");
      expect(getEffectiveCategory(state.tasks, state.tasks[0])).toBeNull();
    });

    it("should inherit category from parent when task has no category", () => {
      const [state, actions] = createTaskStore();
      const parentId = actions.addTask("Parent");
      actions.updateTask(parentId, { category: "red" });
      actions.addTask("Child", parentId);

      const child = state.tasks[0].subtasks[0];
      expect(child.category).toBeNull();
      expect(getEffectiveCategory(state.tasks, child)).toBe("red");
    });

    it("should inherit category from grandparent through uncategorized parent", () => {
      const [state, actions] = createTaskStore();
      const grandparentId = actions.addTask("Grandparent");
      actions.updateTask(grandparentId, { category: "green" });
      const parentId = actions.addTask("Parent", grandparentId);
      actions.addTask("Child", parentId);

      const child = state.tasks[0].subtasks[0].subtasks[0];
      expect(getEffectiveCategory(state.tasks, child)).toBe("green");
    });

    it("should prefer the task's own category over parent's", () => {
      const [state, actions] = createTaskStore();
      const parentId = actions.addTask("Parent");
      actions.updateTask(parentId, { category: "red" });
      const childId = actions.addTask("Child", parentId);
      actions.updateTask(childId, { category: "blue" });

      const child = state.tasks[0].subtasks[0];
      expect(getEffectiveCategory(state.tasks, child)).toBe("blue");
    });

    it("should prefer nearest ancestor's category", () => {
      const [state, actions] = createTaskStore();
      const grandparentId = actions.addTask("Grandparent");
      actions.updateTask(grandparentId, { category: "red" });
      const parentId = actions.addTask("Parent", grandparentId);
      actions.updateTask(parentId, { category: "purple" });
      actions.addTask("Child", parentId);

      const child = state.tasks[0].subtasks[0].subtasks[0];
      expect(getEffectiveCategory(state.tasks, child)).toBe("purple");
    });
  });

  it("should manage calendar draft slots separately from tasks", () => {
    const [state, actions] = createTaskStore();
    const slotId = actions.addCalendarDraftSlot(
      new Date("2026-02-20T09:00:00"),
      45,
    );

    expect(state.tasks).toHaveLength(0);
    expect(state.calendarDraftSlots).toHaveLength(1);
    expect(state.calendarDraftSlots[0].id).toBe(slotId);
    expect(state.calendarDraftSlots[0].title).toBe("New slot");

    actions.updateCalendarDraftSlotTitle(slotId, "Deep work");
    expect(state.calendarDraftSlots[0].title).toBe("Deep work");

    actions.updateCalendarDraftSlotDuration(slotId, 60, 10 * 60 + 30);
    const updatedStart = new Date(
      state.calendarDraftSlots[0].start as Date | string,
    );
    expect(updatedStart.getHours()).toBe(10);
    expect(updatedStart.getMinutes()).toBe(30);

    const storedRaw = localStorage.getItem("timeblocks-tasks");
    expect(storedRaw).not.toBeNull();
    const stored = JSON.parse(storedRaw ?? "{}");
    expect(Array.isArray(stored.tasks)).toBe(true);
    expect(Array.isArray(stored.calendarDraftSlots)).toBe(true);
    expect(stored.tasks).toHaveLength(0);
    expect(stored.calendarDraftSlots).toHaveLength(1);

    actions.removeCalendarDraftSlot(slotId);
    expect(state.calendarDraftSlots).toHaveLength(0);
  });

  it("should place task at correct position when index is computed from filtered array (cross-status drag)", () => {
    // Reproduces the bug: in_progress task before todo tasks in the array.
    // The Board's handleDrop must exclude the dragged task when computing
    // the insertion index, otherwise it's off-by-one.
    localStorage.setItem(
      "timeblocks-tasks",
      JSON.stringify({
        tasks: [
          {
            id: "ip-task",
            title: "In Progress Task",
            status: "in_progress",
            subtasks: [],
            scheduledTimes: [],
          },
          {
            id: "todo-1",
            title: "Todo 1",
            status: "todo",
            subtasks: [],
            scheduledTimes: [],
          },
          {
            id: "todo-2",
            title: "Todo 2",
            status: "todo",
            subtasks: [],
            scheduledTimes: [],
          },
        ],
      }),
    );
    const [state, actions] = createTaskStore();

    // Mimics the FIXED Board handleDrop: filter out the dragged task first,
    // then find the insertion index in the filtered array.
    const withoutDragged = state.tasks.filter((t) => t.id !== "ip-task");
    const insertAt = withoutDragged.findIndex((t) => t.status === "todo");
    expect(insertAt).toBe(0);

    actions.moveTaskToRootAtIndexWithStatus("ip-task", "todo", insertAt);

    const todoTasks = state.tasks.filter((t) => t.status === "todo");
    expect(todoTasks[0].id).toBe("ip-task");
    expect(todoTasks[1].id).toBe("todo-1");
    expect(todoTasks[2].id).toBe("todo-2");
  });

  describe("auto-expand collapsed parent on subtask operations", () => {
    it("should expand collapsed parent when moving a task into it", () => {
      const [state, actions] = createTaskStore();
      const parentId = actions.addTask("Parent");
      actions.addTask("Existing child", parentId);
      actions.toggleCollapse(parentId);
      expect(state.tasks[0].isCollapsed).toBe(true);

      const childId = actions.addTask("New sibling");
      actions.moveSubtaskToIndex(childId, parentId, 0);
      expect(state.tasks[0].isCollapsed).toBe(false);
    });

    it("should expand collapsed parent when adding a new subtask", () => {
      const [state, actions] = createTaskStore();
      const parentId = actions.addTask("Parent");
      actions.addTask("Existing child", parentId);
      actions.toggleCollapse(parentId);
      expect(state.tasks[0].isCollapsed).toBe(true);

      actions.addTask("New child", parentId);
      expect(state.tasks[0].isCollapsed).toBe(false);
    });
  });

  describe("weekly routine", () => {
    it("initializes weeklyTemplate as an empty array", () => {
      const [state] = createTaskStore();
      expect(state.weeklyTemplate).toEqual([]);
    });

    it("addRoutineItem persists every field and returns the new id", () => {
      const [state, actions] = createTaskStore();
      const id = actions.addRoutineItem({
        title: "Morning workout",
        duration: 45,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
        category: "blue",
        description: "Stretch + run",
        dueDate: null,
        importance: "high",
        urgency: "low",
      });

      expect(typeof id).toBe("string");
      expect(state.weeklyTemplate).toHaveLength(1);
      expect(state.weeklyTemplate[0]).toMatchObject({
        id,
        title: "Morning workout",
        duration: 45,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
        category: "blue",
        description: "Stretch + run",
        dueDate: null,
        importance: "high",
        urgency: "low",
      });
    });

    it("updateRoutineItem mutates only the provided fields on the matching item", () => {
      const [state, actions] = createTaskStore();
      const id = actions.addRoutineItem({
        title: "Workout",
        duration: 30,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
      });

      actions.updateRoutineItem(id, {
        title: "Yoga",
        duration: 45,
        category: "green",
      });

      expect(state.weeklyTemplate[0]).toMatchObject({
        id,
        title: "Yoga",
        duration: 45,
        homeDay: 1,
        startMinutes: 7 * 60,
        category: "green",
      });
    });

    it("deleteRoutineItem removes only the matching item", () => {
      const [state, actions] = createTaskStore();
      const keepId = actions.addRoutineItem({
        title: "Workout",
        duration: 30,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
      });
      const removeId = actions.addRoutineItem({
        title: "Stretch",
        duration: 15,
        homeDay: 1,
        startMinutes: 8 * 60,
        repeatDays: [],
      });

      actions.deleteRoutineItem(removeId);

      expect(state.weeklyTemplate).toHaveLength(1);
      expect(state.weeklyTemplate[0].id).toBe(keepId);
    });

    it("startDay inserts draft slots tagged with the source routine item id", () => {
      const [state, actions] = createTaskStore();
      const itemId = actions.addRoutineItem({
        title: "Workout",
        duration: 45,
        homeDay: 1, // Monday
        startMinutes: 7 * 60,
        repeatDays: [],
      });

      // Monday 2026-02-23 09:07 local time
      const now = new Date(2026, 1, 23, 9, 7, 0, 0);
      actions.startDay(now);

      expect(state.calendarDraftSlots).toHaveLength(1);
      const slot = state.calendarDraftSlots[0];
      expect(slot.templateItemId).toBe(itemId);
      expect(slot.title).toBe("Workout");
      expect(slot.duration).toBe(45);
      const slotStart = new Date(slot.start as Date | string);
      expect(slotStart.getFullYear()).toBe(2026);
      expect(slotStart.getMonth()).toBe(1);
      expect(slotStart.getDate()).toBe(23);
      expect(slotStart.getHours()).toBe(9);
      // 9:07 → next 15-min boundary is 9:15
      expect(slotStart.getMinutes()).toBe(15);
    });

    it("startDay only stamps items whose home day matches today's weekday", () => {
      const [state, actions] = createTaskStore();
      actions.addRoutineItem({
        title: "Saturday yoga",
        duration: 30,
        homeDay: 6,
        startMinutes: 8 * 60,
        repeatDays: [],
      });
      actions.addRoutineItem({
        title: "Monday workout",
        duration: 45,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
      });

      const monday = new Date(2026, 1, 23, 9, 0, 0, 0);
      actions.startDay(monday);

      expect(state.calendarDraftSlots).toHaveLength(1);
      expect(state.calendarDraftSlots[0].title).toBe("Monday workout");
    });

    it("loads a pre-existing store without errors and normalizes the missing weeklyTemplate to []", () => {
      localStorage.setItem(
        "timeblocks-tasks",
        JSON.stringify({
          tasks: [
            {
              id: "task-1",
              title: "Old task",
              status: "todo",
              subtasks: [],
              scheduledTimes: [],
            },
          ],
          calendarDraftSlots: [
            {
              id: "manual-slot",
              title: "Manual",
              start: "2026-02-23T08:00:00.000Z",
              duration: 30,
            },
          ],
        }),
      );

      const [state] = createTaskStore();
      expect(state.weeklyTemplate).toEqual([]);
      expect(state.calendarDraftSlots).toHaveLength(1);
      expect(state.calendarDraftSlots[0].templateItemId).toBeUndefined();
    });

    it("round-trips weeklyTemplate and templateItemId through localStorage", () => {
      const [, actions] = createTaskStore();
      const itemId = actions.addRoutineItem({
        title: "Workout",
        duration: 45,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
      });
      const monday = new Date(2026, 1, 23, 9, 0, 0, 0);
      actions.startDay(monday);

      const raw = localStorage.getItem("timeblocks-tasks");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(Array.isArray(parsed.weeklyTemplate)).toBe(true);
      expect(parsed.weeklyTemplate).toHaveLength(1);
      expect(parsed.weeklyTemplate[0].id).toBe(itemId);
      expect(parsed.weeklyTemplate[0].homeDay).toBe(1);
      expect(parsed.weeklyTemplate[0].startMinutes).toBe(7 * 60);
      const stamped = parsed.calendarDraftSlots.find(
        (slot: { templateItemId?: string }) => slot.templateItemId === itemId,
      );
      expect(stamped).toBeDefined();
      expect(stamped.templateItemId).toBe(itemId);
    });

    describe("detachRoutineGhost", () => {
      it("dragging a ghost (startMinutes change) clones the item onto the ghost day and removes that day from the original's repeatDays", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 30,
          homeDay: 1, // Monday home
          startMinutes: 7 * 60,
          repeatDays: [3, 5], // Wed + Fri ghosts
          category: "blue",
          description: "Stretch + run",
        });

        const cloneId = actions.detachRoutineGhost(sourceId, 3, {
          startMinutes: 8 * 60,
        });

        expect(typeof cloneId).toBe("string");
        expect(state.weeklyTemplate).toHaveLength(2);

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.homeDay).toBe(1);
        expect(original.repeatDays).toEqual([5]);
        expect(original.startMinutes).toBe(7 * 60);
        expect(original.duration).toBe(30);
        expect(original.title).toBe("Workout");

        const clone = state.weeklyTemplate.find((i) => i.id === cloneId)!;
        expect(clone.homeDay).toBe(3);
        expect(clone.repeatDays).toEqual([]);
        expect(clone.startMinutes).toBe(8 * 60);
        expect(clone.duration).toBe(30);
        expect(clone.title).toBe("Workout");
        expect(clone.category).toBe("blue");
        expect(clone.description).toBe("Stretch + run");
      });

      it("is a no-op (returns null) when called for the home day or for a day not in repeatDays", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 30,
          homeDay: 1,
          startMinutes: 7 * 60,
          repeatDays: [3, 5],
        });

        const homeAttempt = actions.detachRoutineGhost(sourceId, 1, {
          startMinutes: 9 * 60,
        });
        expect(homeAttempt).toBeNull();

        const noGhostAttempt = actions.detachRoutineGhost(sourceId, 2, {
          startMinutes: 9 * 60,
        });
        expect(noGhostAttempt).toBeNull();

        expect(state.weeklyTemplate).toHaveLength(1);
        const original = state.weeklyTemplate[0];
        expect(original.id).toBe(sourceId);
        expect(original.repeatDays).toEqual([3, 5]);
        expect(original.startMinutes).toBe(7 * 60);
      });

      it("detaching the only repeat-day leaves the original valid as a solo home-day item", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 30,
          homeDay: 1, // Monday only
          startMinutes: 7 * 60,
          repeatDays: [3], // single Wednesday ghost
        });

        const cloneId = actions.detachRoutineGhost(sourceId, 3, {
          startMinutes: 8 * 60,
        });

        expect(state.weeklyTemplate).toHaveLength(2);

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original).toBeDefined();
        expect(original.repeatDays).toEqual([]);
        expect(original.homeDay).toBe(1);
        expect(original.startMinutes).toBe(7 * 60);

        const clone = state.weeklyTemplate.find((i) => i.id === cloneId)!;
        expect(clone.homeDay).toBe(3);
        expect(clone.startMinutes).toBe(8 * 60);
      });

      it("editing a ghost's title/category via the modal clones with the edits and leaves the original's old values on its remaining days", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 30,
          homeDay: 1,
          startMinutes: 7 * 60,
          repeatDays: [3, 5],
          category: "blue",
        });

        const cloneId = actions.detachRoutineGhost(sourceId, 5, {
          title: "Friday yoga",
          category: "green",
          importance: "high",
        });

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.title).toBe("Workout");
        expect(original.category).toBe("blue");
        expect(original.importance).toBe("none");
        expect(original.repeatDays).toEqual([3]);
        expect(original.startMinutes).toBe(7 * 60);
        expect(original.duration).toBe(30);

        const clone = state.weeklyTemplate.find((i) => i.id === cloneId)!;
        expect(clone.homeDay).toBe(5);
        expect(clone.title).toBe("Friday yoga");
        expect(clone.category).toBe("green");
        expect(clone.importance).toBe("high");
        // Unedited fields fall back to the source's values.
        expect(clone.startMinutes).toBe(7 * 60);
        expect(clone.duration).toBe(30);
      });

      it("resizing a ghost (startMinutes + duration change) clones with the new duration and leaves the original's duration intact on its other days", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 30,
          homeDay: 1,
          startMinutes: 7 * 60,
          repeatDays: [3, 5],
        });

        const cloneId = actions.detachRoutineGhost(sourceId, 5, {
          startMinutes: 7 * 60,
          duration: 60,
        });

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.duration).toBe(30);
        expect(original.repeatDays).toEqual([3]);

        const clone = state.weeklyTemplate.find((i) => i.id === cloneId)!;
        expect(clone.homeDay).toBe(5);
        expect(clone.duration).toBe(60);
        expect(clone.startMinutes).toBe(7 * 60);
      });
    });

    describe("resolver-push detach", () => {
      it("addRoutineItem that overlaps a ghost on the same day pushes the ghost forward and detaches it; the original loses that day from its repeatDays", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 60,
          homeDay: 1, // Monday home
          startMinutes: 7 * 60, // 07:00
          repeatDays: [3, 5], // Wed + Fri ghosts
          category: "blue",
          description: "Stretch + run",
        });

        // Draw a new home item on Wednesday at 06:30 for 60min. Its end (07:30)
        // overlaps the Wednesday ghost (07:00-08:00), so the resolver pushes
        // the ghost to 07:30 and the ghost detaches into a Wed-home clone.
        const newId = actions.addRoutineItem({
          title: "Standup",
          duration: 60,
          homeDay: 3, // Wednesday
          startMinutes: 6 * 60 + 30,
          repeatDays: [],
        });

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.homeDay).toBe(1);
        expect(original.repeatDays).toEqual([5]);
        expect(original.startMinutes).toBe(7 * 60);
        expect(original.duration).toBe(60);

        const clone = state.weeklyTemplate.find(
          (i) => i.id !== sourceId && i.id !== newId,
        )!;
        expect(clone).toBeDefined();
        expect(clone.title).toBe("Workout");
        expect(clone.homeDay).toBe(3);
        expect(clone.startMinutes).toBe(7 * 60 + 30);
        expect(clone.duration).toBe(60);
        expect(clone.repeatDays).toEqual([]);
        expect(clone.category).toBe("blue");
        expect(clone.description).toBe("Stretch + run");
      });

      it("a single resolver pass that displaces multiple ghosts in a chain detaches each independently", () => {
        const [state, actions] = createTaskStore();
        // Source A: home Mon, Wed + Fri ghosts at 07:00 (60 min).
        const sourceAId = actions.addRoutineItem({
          title: "Workout",
          duration: 60,
          homeDay: 1,
          startMinutes: 7 * 60,
          repeatDays: [3, 5],
        });
        // Source B: home Tue, Wed ghost at 08:00 (60 min).
        const sourceBId = actions.addRoutineItem({
          title: "Reading",
          duration: 60,
          homeDay: 2,
          startMinutes: 8 * 60,
          repeatDays: [3],
        });

        // Draw a new Wed-home item at 06:30 (60 min). It pushes the Workout
        // ghost from 07:00 → 07:30 (end 08:30), which in turn pushes the
        // Reading ghost from 08:00 → 08:30 (end 09:30). Both detach.
        const newId = actions.addRoutineItem({
          title: "Standup",
          duration: 60,
          homeDay: 3,
          startMinutes: 6 * 60 + 30,
          repeatDays: [],
        });

        const originalA = state.weeklyTemplate.find((i) => i.id === sourceAId)!;
        expect(originalA.repeatDays).toEqual([5]);
        expect(originalA.startMinutes).toBe(7 * 60);

        const originalB = state.weeklyTemplate.find((i) => i.id === sourceBId)!;
        expect(originalB.repeatDays).toEqual([]);
        expect(originalB.startMinutes).toBe(8 * 60);
        expect(originalB.homeDay).toBe(2);

        const wedClones = state.weeklyTemplate.filter(
          (i) =>
            i.homeDay === 3 &&
            i.id !== sourceAId &&
            i.id !== sourceBId &&
            i.id !== newId,
        );
        expect(wedClones).toHaveLength(2);

        const workoutClone = wedClones.find((c) => c.title === "Workout")!;
        expect(workoutClone).toBeDefined();
        expect(workoutClone.startMinutes).toBe(7 * 60 + 30);
        expect(workoutClone.duration).toBe(60);
        expect(workoutClone.repeatDays).toEqual([]);

        const readingClone = wedClones.find((c) => c.title === "Reading")!;
        expect(readingClone).toBeDefined();
        expect(readingClone.startMinutes).toBe(8 * 60 + 30);
        expect(readingClone.duration).toBe(60);
        expect(readingClone.repeatDays).toEqual([]);
      });

      it("does not detach when the resolver does not actually displace the ghost (no overlap)", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 60,
          homeDay: 1,
          startMinutes: 7 * 60,
          repeatDays: [3, 5],
        });

        actions.addRoutineItem({
          title: "Lunch",
          duration: 30,
          homeDay: 3, // Wednesday
          startMinutes: 12 * 60, // 12:00 — far from the 07:00 ghost
          repeatDays: [],
        });

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.repeatDays).toEqual([3, 5]);
        expect(original.startMinutes).toBe(7 * 60);
        expect(state.weeklyTemplate).toHaveLength(2);
      });

      it("resizing a home item so its new end overlaps a later ghost pushes that ghost forward and detaches it", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 60,
          homeDay: 1,
          startMinutes: 8 * 60, // 08:00
          repeatDays: [3, 5], // Wed + Fri ghosts at 08:00-09:00
        });
        const resizedId = actions.addRoutineItem({
          title: "Standup",
          duration: 30,
          homeDay: 3,
          startMinutes: 7 * 60, // 07:00 — initially no overlap
          repeatDays: [],
        });

        const before = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(before.repeatDays).toEqual([3, 5]);
        expect(state.weeklyTemplate).toHaveLength(2);

        // Resize Standup to 90 minutes — now ends at 08:30 and overlaps the
        // Wednesday ghost at 08:00. The resolver pushes the ghost to 08:30
        // and the ghost detaches into a Wed-home clone.
        actions.updateRoutineItem(resizedId, { duration: 90 });

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.repeatDays).toEqual([5]);
        expect(original.duration).toBe(60);
        expect(original.startMinutes).toBe(8 * 60);

        const clone = state.weeklyTemplate.find(
          (i) => i.id !== sourceId && i.id !== resizedId,
        )!;
        expect(clone).toBeDefined();
        expect(clone.title).toBe("Workout");
        expect(clone.homeDay).toBe(3);
        expect(clone.startMinutes).toBe(8 * 60 + 30);
        expect(clone.duration).toBe(60);
        expect(clone.repeatDays).toEqual([]);
      });

      it("moving an existing home item so it overlaps a ghost on the same day pushes the ghost forward and detaches it", () => {
        const [state, actions] = createTaskStore();
        const sourceId = actions.addRoutineItem({
          title: "Workout",
          duration: 60,
          homeDay: 1,
          startMinutes: 7 * 60,
          repeatDays: [3, 5],
        });
        const movedId = actions.addRoutineItem({
          title: "Standup",
          duration: 60,
          homeDay: 3,
          startMinutes: 12 * 60, // initially nowhere near the ghost
          repeatDays: [],
        });

        // Sanity: nothing detached yet.
        const before = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(before.repeatDays).toEqual([3, 5]);
        expect(state.weeklyTemplate).toHaveLength(2);

        // Move Standup to 06:30 — now its end (07:30) overlaps the Wed ghost
        // (07:00-08:00). The resolver pushes the ghost to 07:30 and detaches.
        actions.updateRoutineItem(movedId, { startMinutes: 6 * 60 + 30 });

        const original = state.weeklyTemplate.find((i) => i.id === sourceId)!;
        expect(original.repeatDays).toEqual([5]);
        expect(original.homeDay).toBe(1);
        expect(original.startMinutes).toBe(7 * 60);
        expect(original.duration).toBe(60);

        const clone = state.weeklyTemplate.find(
          (i) => i.id !== sourceId && i.id !== movedId,
        )!;
        expect(clone).toBeDefined();
        expect(clone.title).toBe("Workout");
        expect(clone.homeDay).toBe(3);
        expect(clone.startMinutes).toBe(7 * 60 + 30);
        expect(clone.duration).toBe(60);
        expect(clone.repeatDays).toEqual([]);
      });
    });

    it("commitDayPreview materializes preview slots for a future day with deterministic ids that survive a re-commit", () => {
      const [state, actions] = createTaskStore();
      const itemId = actions.addRoutineItem({
        title: "Friday workout",
        duration: 45,
        homeDay: 5, // Friday
        startMinutes: 9 * 60,
        repeatDays: [],
      });

      // Today: Mon 2026-02-23 09:00. Commit Fri 2026-02-27.
      const now = new Date(2026, 1, 23, 9, 0, 0, 0);
      const friday = new Date(2026, 1, 27, 0, 0, 0, 0);

      actions.commitDayPreview(friday, [], now);

      expect(state.calendarDraftSlots).toHaveLength(1);
      const slot = state.calendarDraftSlots[0];
      expect(slot.id).toBe(`routine-preview:${itemId}:2026-02-27`);
      expect(slot.templateItemId).toBe(itemId);
      expect(slot.title).toBe("Friday workout");
      expect(slot.duration).toBe(45);
      const start = new Date(slot.start as Date | string);
      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(1);
      expect(start.getDate()).toBe(27);
      expect(start.getHours()).toBe(9);
      expect(start.getMinutes()).toBe(0);

      // Re-committing the same day reuses the same deterministic id, not a
      // brand-new uuid — the slot count stays at one.
      actions.commitDayPreview(friday, [], now);
      expect(state.calendarDraftSlots).toHaveLength(1);
      expect(state.calendarDraftSlots[0].id).toBe(
        `routine-preview:${itemId}:2026-02-27`,
      );
    });

    it("re-pressing startDay wipes today's templated slots and preserves manually-drawn ones", () => {
      const [state, actions] = createTaskStore();
      actions.addRoutineItem({
        title: "Workout",
        duration: 30,
        homeDay: 1,
        startMinutes: 7 * 60,
        repeatDays: [],
      });

      const monday = new Date(2026, 1, 23, 9, 0, 0, 0);
      const manualStart = new Date(2026, 1, 23, 14, 0, 0, 0);
      actions.addCalendarDraftSlot(manualStart, 60, "Hand-drawn focus");

      actions.startDay(monday);
      const afterFirst = state.calendarDraftSlots
        .map((slot) => slot.title)
        .sort();
      expect(afterFirst).toEqual(["Hand-drawn focus", "Workout"]);
      const templatedAfterFirst = state.calendarDraftSlots.filter(
        (slot) => slot.templateItemId,
      );
      expect(templatedAfterFirst).toHaveLength(1);

      const later = new Date(2026, 1, 23, 11, 0, 0, 0);
      actions.startDay(later);

      const titlesAfterSecond = state.calendarDraftSlots
        .map((slot) => slot.title)
        .sort();
      expect(titlesAfterSecond).toEqual(["Hand-drawn focus", "Workout"]);
      const manual = state.calendarDraftSlots.find(
        (slot) => slot.title === "Hand-drawn focus",
      )!;
      expect(manual.templateItemId).toBeUndefined();
      const templatedAfterSecond = state.calendarDraftSlots.filter(
        (slot) => slot.templateItemId,
      );
      expect(templatedAfterSecond).toHaveLength(1);
      const reStampedStart = new Date(
        templatedAfterSecond[0].start as Date | string,
      );
      expect(reStampedStart.getHours()).toBe(11);
      expect(reStampedStart.getMinutes()).toBe(0);
    });
  });
});

describe("setSubtreeStatus", () => {
  it("rewrites a leaf task's status", () => {
    const leaf = makeTask({ status: "inbox" });
    setSubtreeStatus(leaf, "note");
    expect(leaf.status).toBe("note");
  });

  it("rewrites every descendant in a deeply nested subtree", () => {
    const grandchild = makeTask({ status: "inbox" });
    const child = makeTask({ status: "inbox", subtasks: [grandchild] });
    const root = makeTask({ status: "inbox", subtasks: [child] });

    setSubtreeStatus(root, "note");

    expect(root.status).toBe("note");
    expect(root.subtasks[0].status).toBe("note");
    expect(root.subtasks[0].subtasks[0].status).toBe("note");
  });

  it("does not touch siblings of the given task", () => {
    const target = makeTask({ status: "inbox" });
    const sibling = makeTask({ status: "todo" });

    setSubtreeStatus(target, "note");

    expect(sibling.status).toBe("todo");
  });

  it("is idempotent when the status already matches", () => {
    const root = makeTask({
      status: "note",
      subtasks: [makeTask({ status: "note" })],
    });

    setSubtreeStatus(root, "note");

    expect(root.status).toBe("note");
    expect(root.subtasks[0].status).toBe("note");
  });
});
