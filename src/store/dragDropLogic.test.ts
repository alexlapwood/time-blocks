
import { describe, it, expect, beforeEach } from "vitest";
import { createTaskStore } from "./taskStore";

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
    const inProgressTasksBefore = state.tasks.filter(t => t.status === "in_progress");
    expect(inProgressTasksBefore.length).toBe(1);
    expect(inProgressTasksBefore[0].id).toBe(taskB.id);

    // 2. Simulate Drag: User drags Task A to "In Progress" column (empty space/container)
    // The current implementation in Dashboard.tsx calls updateTask with new status
    actions.moveTaskToStatus(taskA.id, "in_progress");
    
    // 3. Expected Behavior (User Intent): Task A should be at the END of "In Progress" column
    // because they dragged it to the column (implied append).
    
    // 4. Actual Behavior (Bug): Task A remains at index 0 in the store, so it appears BEFORE Task B
    // Store: [Task A (in_progress), Task B (in_progress)]
    
    const inProgressTasksAfter = state.tasks.filter(t => t.status === "in_progress");
    
    // We expect 2 tasks
    expect(inProgressTasksAfter.length).toBe(2);
    
    // FIXED EXPECTATION: Task A should be appended after Task B
    expect(inProgressTasksAfter[0].id).toBe(taskB.id);
    expect(inProgressTasksAfter[1].id).toBe(taskA.id);
  });
});
