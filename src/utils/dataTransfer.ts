export const exportData = () => {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith("timeblocks-") || key.startsWith("timeblocks:"))
    ) {
      data[key] = localStorage.getItem(key) || "";
    }
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `timeblocks-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importData = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";

  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (typeof data !== "object" || data === null) {
          throw new Error("Invalid backup format");
        }

        // Only restore keys that look like timeblocks data
        let importedCount = 0;
        for (const [key, value] of Object.entries(data)) {
          if (
            typeof value === "string" &&
            (key.startsWith("timeblocks-") || key.startsWith("timeblocks:"))
          ) {
            localStorage.setItem(key, value);
            importedCount++;
          }
        }

        if (importedCount > 0) {
          window.location.reload();
        } else {
          alert("No valid timeblocks data found in the file.");
        }
      } catch (err) {
        console.error("Failed to import data:", err);
        alert(
          "Failed to parse backup file. Please ensure it's a valid JSON backup.",
        );
      }
    };
    reader.readAsText(file);
  };

  input.click();
};
