import { type Component, Show, createSignal } from "solid-js";
import { cva } from "class-variance-authority";
import { RoutineCanvas } from "./RoutineCanvas";
import { TaskEditorModal, modalButtonClasses } from "./TaskEditorModal";
import {
  useTaskStore,
  type RoutineItem,
  type Weekday,
} from "../store/taskStore";

const backdropClasses = cva(
  "fixed inset-0 z-[80] flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_75%,transparent)] p-6 backdrop-blur-[10px]",
);

const cardClasses = cva(
  "flex max-h-[92vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--outline) bg-(--surface) shadow-(--shadow-pop)",
);

const headerClasses = cva(
  "flex items-start justify-between gap-4 border-b border-(--outline-soft) px-[1.6rem] pb-4 pt-6",
);

const closeButtonClasses = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[0.9rem] py-[0.4rem] font-body text-[0.82rem] font-medium leading-none tracking-[0.02em] text-(--ink-muted) transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--brand)_30%,var(--outline))] hover:text-(--ink) hover:shadow-[0_2px_6px_color-mix(in_srgb,var(--brand)_12%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
);

export const RoutineModal: Component<{
  open: boolean;
  onClose: () => void;
}> = (props) => {
  const [state, actions] = useTaskStore();
  const [activeItemId, setActiveItemId] = createSignal<string | null>(null);
  // When set, the editor was opened from a ghost copy on this day. The very
  // next field change detaches that ghost: a clone is created, the editor
  // swaps to the clone (so further keystrokes apply to it), and ghost mode
  // ends. Subsequent edits behave like a normal home-item edit.
  const [activeGhostDay, setActiveGhostDay] = createSignal<Weekday | null>(
    null,
  );

  const findItem = (id: string): RoutineItem | undefined =>
    state.weeklyTemplate.find((entry) => entry.id === id);

  const closeEditor = () => {
    setActiveItemId(null);
    setActiveGhostDay(null);
  };

  return (
    <Show when={props.open}>
      <div
        class={backdropClasses()}
        role="dialog"
        aria-modal="true"
        aria-label="Weekly routine"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <div class={cardClasses()}>
          <header class={headerClasses()}>
            <div>
              <div class="mb-[0.35rem] text-[0.7rem] font-medium uppercase tracking-[0.2em] text-(--ink-soft)">
                Weekly routine
              </div>
              <h3 class="m-0 font-display text-[1.4rem] text-(--ink)">
                Mon–Sun template
              </h3>
            </div>
            <button
              type="button"
              class={closeButtonClasses()}
              onClick={props.onClose}
            >
              Close
            </button>
          </header>

          <div class="flex flex-1 min-h-0 flex-col overflow-hidden">
            <RoutineCanvas
              onOpenItem={(id, ghostDay) => {
                setActiveItemId(id);
                setActiveGhostDay(ghostDay ?? null);
              }}
            />
          </div>
        </div>
      </div>
      <TaskEditorModal
        itemId={activeItemId()}
        data={() => {
          const id = activeItemId();
          if (!id) return null;
          const item = findItem(id);
          if (!item) return null;
          return {
            title: item.title,
            category: item.category ?? null,
            dueDate: item.dueDate ?? null,
            importance: item.importance ?? "none",
            urgency: item.urgency ?? "none",
            description: item.description ?? "",
          };
        }}
        onFieldChange={(fields) => {
          const id = activeItemId();
          if (!id) return;
          const ghostDay = activeGhostDay();
          if (ghostDay !== null) {
            const cloneId = actions.detachRoutineGhost(id, ghostDay, fields);
            if (cloneId) {
              setActiveItemId(cloneId);
              setActiveGhostDay(null);
            }
            return;
          }
          actions.updateRoutineItem(id, fields);
        }}
        repeatsOn={(() => {
          const id = activeItemId();
          if (!id) return undefined;
          // The "Repeats on" pill row only makes sense for the source
          // (home) item. While a ghost editor is open, the source's repeat
          // pattern is intentionally not exposed here so a stray click
          // can't mutate the source before the user has chosen to detach.
          if (activeGhostDay() !== null) return undefined;
          const item = findItem(id);
          if (!item) return undefined;
          return {
            homeDay: item.homeDay,
            selectedDays: item.repeatDays,
            onToggle: (day) => {
              const current = findItem(id);
              if (!current) return;
              const has = current.repeatDays.includes(day);
              const nextDays = has
                ? current.repeatDays.filter((d) => d !== day)
                : [...current.repeatDays, day];
              actions.updateRoutineItem(id, { repeatDays: nextDays });
            },
          };
        })()}
        eyebrow="Edit routine item"
        heading="Routine item details"
        idPrefix="routine-item"
        onClose={closeEditor}
        footer={
          <>
            <button
              type="button"
              class={modalButtonClasses({ tone: "danger" })}
              onClick={() => {
                const id = activeItemId();
                if (!id) return;
                const ghostDay = activeGhostDay();
                if (ghostDay !== null) {
                  // Deleting a ghost = "I don't want this routine to repeat
                  // on this day". Mutate only the source's repeatDays so
                  // the user's other days survive.
                  const current = findItem(id);
                  if (current) {
                    actions.updateRoutineItem(id, {
                      repeatDays: current.repeatDays.filter(
                        (d) => d !== ghostDay,
                      ),
                    });
                  }
                } else {
                  actions.deleteRoutineItem(id);
                }
                closeEditor();
              }}
            >
              Delete
            </button>
            <button
              type="button"
              class={modalButtonClasses({ tone: "primary" })}
              onClick={closeEditor}
            >
              Save
            </button>
          </>
        }
      />
    </Show>
  );
};
