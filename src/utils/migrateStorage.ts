type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const NOTES_BLOB_KEY = "timeblocks-notes";
const TASKS_BLOB_KEY = "timeblocks-tasks";

// Migrate the legacy free-text notes blob (saved under `timeblocks-notes`) into
// a single root note task on the tasks blob. Idempotent: only runs when the old
// key is present and non-empty. Accepts a Storage-like port so tests can pass
// an in-memory adapter; production wires this to `window.localStorage`.
export const migrateNotesBlob = (storage: StoragePort): void => {
  const blob = storage.getItem(NOTES_BLOB_KEY);
  if (blob === null) return;

  const trimmed = blob.trim();
  if (trimmed === "") {
    storage.removeItem(NOTES_BLOB_KEY);
    return;
  }

  const note = {
    id: crypto.randomUUID(),
    title: "Notes",
    status: "note",
    description: blob,
    dueDate: null,
    category: null,
    importance: "none",
    urgency: "none",
    subtasks: [],
    scheduledTimes: [],
  };

  const tasksRaw = storage.getItem(TASKS_BLOB_KEY);
  let parsed: { tasks?: unknown[] } & Record<string, unknown> = {};
  if (tasksRaw !== null) {
    try {
      const candidate = JSON.parse(tasksRaw);
      if (candidate && typeof candidate === "object") parsed = candidate;
    } catch {
      parsed = {};
    }
  }

  const existingTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const next = { ...parsed, tasks: [...existingTasks, note] };

  storage.setItem(TASKS_BLOB_KEY, JSON.stringify(next));
  storage.removeItem(NOTES_BLOB_KEY);
};

export const migrateStorage = () => {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return;
  }

  const migrations: Record<string, string> = {
    "planner-tasks": "timeblocks-tasks",
    "planner-calendar-settings": "timeblocks-calendar-settings",
    "planner-view-visibility": "timeblocks-view-visibility",
    "planner:notes": "timeblocks-notes",
    "planner-theme": "timeblocks-theme",
    "planner-mode": "timeblocks-mode",
  };

  try {
    for (const [oldKey, newKey] of Object.entries(migrations)) {
      const oldVal = window.localStorage.getItem(oldKey);
      const newVal = window.localStorage.getItem(newKey);

      if (oldVal !== null && newVal === null) {
        window.localStorage.setItem(newKey, oldVal);
        // Optionally remove old keys after migration to clean up
        window.localStorage.removeItem(oldKey);
      }
    }

    migrateNotesBlob(window.localStorage);
  } catch (error) {
    console.error("Failed to migrate local storage:", error);
  }
};
