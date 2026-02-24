import { ErrorBoundary, onMount } from "solid-js";
import { TaskProvider } from "./store/taskStore";
import {
  applyMode,
  applyTheme,
  getInitialMode,
  getInitialTheme,
} from "./theme";
import "./index.css";
import { Dashboard } from "./components/Dashboard";

export default function App() {
  onMount(() => {
    applyTheme(getInitialTheme());
    applyMode(getInitialMode());
  });

  return (
    <ErrorBoundary
      fallback={(err) => (
        <div class="p-4 text-red-500">Error: {err.toString()}</div>
      )}
    >
      <TaskProvider>
        <Dashboard />
      </TaskProvider>
    </ErrorBoundary>
  );
}