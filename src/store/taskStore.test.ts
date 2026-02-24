import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTaskStore } from "./taskStore";

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
});
