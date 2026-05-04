import { type Component } from "solid-js";
import { TaskListPanel } from "./TaskListPanel";

export const Notes: Component<{
  onOpenTask?: (taskId: string, source?: "add-card") => void;
}> = (props) => {
  return (
    <TaskListPanel
      listId="notes"
      rootStatus="note"
      heading="Notes"
      inputPlaceholder="Add a note..."
      contextMenu={{
        addChildLabel: "Add sub-note",
        newChildTitle: "New sub-note",
      }}
      onOpenTask={props.onOpenTask}
    />
  );
};
