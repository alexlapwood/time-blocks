import { type Component } from "solid-js";
import { useTaskStore } from "../store/taskStore";
import { TaskListPanel } from "./TaskListPanel";

export const Inbox: Component<{
  onOpenTask?: (taskId: string, source?: "add-card") => void;
}> = (props) => {
  const [, actions] = useTaskStore();

  return (
    <TaskListPanel
      listId="inbox"
      rootStatus="inbox"
      heading="Inbox"
      quickAdd={{ kind: "input", placeholder: "Add a task..." }}
      contextMenu={{
        addChildLabel: "Add subtask",
        newChildTitle: "New subtask",
      }}
      cardOptions={{
        showDueDate: true,
        onToggleDone: actions.toggleDone,
      }}
      onOpenTask={props.onOpenTask}
    />
  );
};
