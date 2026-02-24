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
  } catch (error) {
    console.error("Failed to migrate local storage:", error);
  }
};
