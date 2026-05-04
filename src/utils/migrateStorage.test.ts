import { describe, it, expect, beforeEach } from "vitest";
import { migrateNotesBlob, migrateStorage } from "./migrateStorage";

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type MockStorage = StoragePort & { snapshot: () => Record<string, string> };

const createMockStorage = (
  initial: Record<string, string> = {},
): MockStorage => {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
    snapshot: () => ({ ...data }),
  };
};

describe("migrateNotesBlob", () => {
  it("no-ops when the old timeblocks-notes key is absent", () => {
    const storage = createMockStorage();

    migrateNotesBlob(storage);

    expect(storage.snapshot()).toEqual({});
  });

  it("removes the old key but does not create a note when the value is empty or whitespace", () => {
    const storage = createMockStorage({ "timeblocks-notes": "   \n  \t" });

    migrateNotesBlob(storage);

    expect(storage.getItem("timeblocks-notes")).toBeNull();
    expect(storage.getItem("timeblocks-tasks")).toBeNull();
  });

  it("handles a malformed timeblocks-tasks value by starting fresh", () => {
    const storage = createMockStorage({
      "timeblocks-notes": "legacy",
      "timeblocks-tasks": "{not-json",
    });

    migrateNotesBlob(storage);

    const parsed = JSON.parse(storage.getItem("timeblocks-tasks")!);
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].status).toBe("note");
  });

  it("preserves existing entries in timeblocks-tasks when adding the note", () => {
    const storage = createMockStorage({
      "timeblocks-notes": "legacy",
      "timeblocks-tasks": JSON.stringify({
        tasks: [
          {
            id: "existing",
            title: "Existing task",
            status: "todo",
            subtasks: [],
            scheduledTimes: [],
          },
        ],
        calendarDraftSlots: [{ id: "slot-keep" }],
      }),
    });

    migrateNotesBlob(storage);

    const parsed = JSON.parse(storage.getItem("timeblocks-tasks")!);
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0].id).toBe("existing");
    expect(parsed.tasks[1].status).toBe("note");
    expect(parsed.calendarDraftSlots).toEqual([{ id: "slot-keep" }]);
  });

  it("creates a single note task with the legacy text and removes the old key", () => {
    const storage = createMockStorage({
      "timeblocks-notes": "My old free-text notes",
    });

    migrateNotesBlob(storage);

    expect(storage.getItem("timeblocks-notes")).toBeNull();

    const tasksBlob = storage.getItem("timeblocks-tasks");
    expect(tasksBlob).not.toBeNull();

    const parsed = JSON.parse(tasksBlob!);
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(parsed.tasks).toHaveLength(1);

    const note = parsed.tasks[0];
    expect(typeof note.id).toBe("string");
    expect(note.id.length).toBeGreaterThan(0);
    expect(note.status).toBe("note");
    expect(note.title).toBe("Notes");
    expect(note.description).toBe("My old free-text notes");
    expect(note.subtasks).toEqual([]);
    expect(note.scheduledTimes).toEqual([]);
    expect(note.importance).toBe("none");
    expect(note.urgency).toBe("none");
  });
});

describe("migrateStorage end-to-end", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy planner:notes through to a note task", () => {
    localStorage.setItem("planner:notes", "Notes from planner days");

    migrateStorage();

    expect(localStorage.getItem("planner:notes")).toBeNull();
    expect(localStorage.getItem("timeblocks-notes")).toBeNull();

    const tasksBlob = localStorage.getItem("timeblocks-tasks");
    expect(tasksBlob).not.toBeNull();

    const parsed = JSON.parse(tasksBlob!);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].status).toBe("note");
    expect(parsed.tasks[0].description).toBe("Notes from planner days");
  });
});
