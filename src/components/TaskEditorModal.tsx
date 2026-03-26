import {
  type Component,
  type JSX,
  Show,
  For,
  createEffect,
  onCleanup,
} from "solid-js";
import { cva } from "class-variance-authority";
import {
  type PriorityLevel,
  type CategoryId,
  PRIORITY_OPTIONS,
} from "../store/taskStore";
import { CategoryCombo } from "./CategoryCombo";

const modalBackdropClasses = cva(
  "fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_75%,transparent)] p-6 backdrop-blur-[10px]",
);

const modalCardClasses = cva(
  "flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--outline) bg-(--surface) shadow-(--shadow-pop) max-[860px]:max-w-[560px]",
);

const modalHeaderClasses = cva(
  "flex items-start justify-between gap-4 border-b border-(--outline-soft) px-[1.6rem] pb-4 pt-6",
);

const modalEyebrowClasses = cva(
  "mb-[0.35rem] text-[0.7rem] font-medium uppercase tracking-[0.2em] text-(--ink-soft)",
);

const modalTitleClasses = cva("m-0 font-display text-[1.4rem] text-(--ink)");

const modalCloseButtonClasses = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[0.9rem] py-[0.4rem] font-body text-[0.82rem] font-medium leading-none tracking-[0.02em] text-(--ink-muted) transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--brand)_30%,var(--outline))] hover:text-(--ink) hover:shadow-[0_2px_6px_color-mix(in_srgb,var(--brand)_12%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
);

const modalBodyClasses = cva(
  "grid grid-cols-2 gap-[1.6rem] overflow-x-hidden overflow-y-auto px-[1.6rem] pb-[1.4rem] pt-[1.2rem] max-[860px]:grid-cols-1 max-[860px]:gap-4",
);

const modalColumnClasses = cva("grid min-w-0 grid-cols-1 content-start gap-4");

const modalFieldClasses = cva("grid min-w-0 gap-[0.3rem]");

const modalLabelClasses = cva(
  "m-0 text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-(--ink-muted)",
);

const modalRowClasses = cva("flex items-center gap-3");

const textInputBase =
  "w-full rounded-(--radius-input) border-2 border-(--outline) bg-(--text-input-bg) px-[0.9rem] py-[0.65rem] font-body font-medium shadow-(--shadow-tile) transition-[transform,box-shadow,border-color] [transition-duration:var(--speed-base)] focus-visible:-translate-y-px focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]";

const modalSelectClasses = cva(`${textInputBase} min-w-0`);

const modalTextareaClasses = cva(
  `${textInputBase} min-h-full resize-y max-[860px]:min-h-[120px]`,
);

const modalFooterClasses = cva(
  "flex justify-end gap-3 border-t border-(--outline-soft) px-[1.6rem] pb-[1.4rem] pt-4",
);

export const modalButtonClasses = cva(
  "cursor-pointer rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[1.4rem] py-[0.55rem] font-body text-[0.88rem] font-medium tracking-[0.02em] text-(--ink) transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
  {
    variants: {
      tone: {
        primary:
          "border-[var(--brand)] bg-[var(--brand)] text-white shadow-[0_2px_8px_color-mix(in_srgb,var(--brand)_25%,transparent)] hover:shadow-[0_4px_14px_color-mix(in_srgb,var(--brand)_35%,transparent)]",
        danger:
          "border-[color-mix(in_srgb,var(--category-red)_50%,var(--outline))] bg-[color-mix(in_srgb,var(--category-red)_15%,var(--surface-solid))] text-(--ink) hover:border-(--category-red) hover:bg-[color-mix(in_srgb,var(--category-red)_25%,var(--surface-solid))] hover:shadow-[0_2px_10px_color-mix(in_srgb,var(--category-red)_20%,transparent)]",
        ghost:
          "border-transparent bg-transparent hover:border-(--outline) hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
      },
    },
    defaultVariants: {
      tone: "primary",
    },
  },
);

export type EditorFields = {
  title: string;
  category: CategoryId | null;
  dueDate: string | null;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  description: string;
};

export const TaskEditorModal: Component<{
  itemId: string | null;
  data: () => EditorFields | null;
  onFieldChange: (fields: Partial<EditorFields>) => void;
  eyebrow: string;
  heading?: string;
  idPrefix: string;
  onClose: () => void;
  footer?: JSX.Element;
}> = (props) => {
  let titleInput: HTMLInputElement | undefined;

  const handleLabelPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    const control = (event.currentTarget as HTMLLabelElement).control;
    control?.focus();
  };

  createEffect(() => {
    if (!props.itemId) return;
    const frame = requestAnimationFrame(() => {
      titleInput?.focus();
      titleInput?.select();
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  createEffect(() => {
    if (!props.itemId) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));
  });

  return (
    <Show when={props.itemId && props.data()}>
      <div
        class={modalBackdropClasses()}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <div class={modalCardClasses()} role="dialog" aria-modal="true">
          <header class={modalHeaderClasses()}>
            <div>
              <div class={modalEyebrowClasses()}>{props.eyebrow}</div>
              <h3 class={modalTitleClasses()}>
                {props.heading ?? "Task details"}
              </h3>
            </div>
            <button
              class={modalCloseButtonClasses()}
              type="button"
              onClick={props.onClose}
            >
              Close
            </button>
          </header>

          <div class={modalBodyClasses()}>
            <div class={modalColumnClasses()}>
              <div class={modalFieldClasses()}>
                <label
                  class={modalLabelClasses()}
                  for={`${props.idPrefix}-title`}
                  onPointerDown={handleLabelPointerDown}
                >
                  Title
                </label>
                <input
                  id={`${props.idPrefix}-title`}
                  ref={titleInput}
                  class={textInputBase}
                  type="text"
                  value={props.data()?.title ?? ""}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.isComposing) return;
                    event.preventDefault();
                    props.onClose();
                  }}
                  onInput={(event) => {
                    props.onFieldChange({ title: event.currentTarget.value });
                  }}
                />
              </div>

              <div class={modalFieldClasses()}>
                <label
                  class={modalLabelClasses()}
                  for={`${props.idPrefix}-category`}
                  onPointerDown={handleLabelPointerDown}
                >
                  Category
                </label>
                <CategoryCombo
                  id={`${props.idPrefix}-category`}
                  value={() => props.data()?.category ?? null}
                  onSelect={(category) => {
                    props.onFieldChange({ category });
                  }}
                />
              </div>

              <div class={modalFieldClasses()}>
                <label
                  class={modalLabelClasses()}
                  for={`${props.idPrefix}-due-date`}
                  onPointerDown={handleLabelPointerDown}
                >
                  Due date
                </label>
                <input
                  id={`${props.idPrefix}-due-date`}
                  class={textInputBase}
                  type="date"
                  value={props.data()?.dueDate ?? ""}
                  onInput={(event) => {
                    const nextValue = event.currentTarget.value;
                    props.onFieldChange({
                      dueDate: nextValue ? nextValue : null,
                    });
                  }}
                />
              </div>

              <div class={modalRowClasses()}>
                <div class={`${modalFieldClasses()} flex-1`}>
                  <label
                    class={modalLabelClasses()}
                    for={`${props.idPrefix}-importance`}
                    onPointerDown={handleLabelPointerDown}
                  >
                    Importance
                  </label>
                  <select
                    id={`${props.idPrefix}-importance`}
                    class={modalSelectClasses()}
                    value={props.data()?.importance ?? "none"}
                    onChange={(event) => {
                      props.onFieldChange({
                        importance: event.currentTarget.value as PriorityLevel,
                      });
                    }}
                  >
                    <For each={PRIORITY_OPTIONS}>
                      {(option) => (
                        <option value={option.id}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </div>

                <div class={`${modalFieldClasses()} flex-1`}>
                  <label
                    class={modalLabelClasses()}
                    for={`${props.idPrefix}-urgency`}
                    onPointerDown={handleLabelPointerDown}
                  >
                    Urgency
                  </label>
                  <select
                    id={`${props.idPrefix}-urgency`}
                    class={modalSelectClasses()}
                    value={props.data()?.urgency ?? "none"}
                    onChange={(event) => {
                      props.onFieldChange({
                        urgency: event.currentTarget.value as PriorityLevel,
                      });
                    }}
                  >
                    <For each={PRIORITY_OPTIONS}>
                      {(option) => (
                        <option value={option.id}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </div>
              </div>
            </div>

            <div class={modalColumnClasses()}>
              <div class={`${modalFieldClasses()} h-full`}>
                <label
                  class={modalLabelClasses()}
                  for={`${props.idPrefix}-description`}
                  onPointerDown={handleLabelPointerDown}
                >
                  Notes
                </label>
                <textarea
                  id={`${props.idPrefix}-description`}
                  class={modalTextareaClasses()}
                  rows={10}
                  value={props.data()?.description ?? ""}
                  onInput={(event) => {
                    props.onFieldChange({
                      description: event.currentTarget.value,
                    });
                  }}
                />
              </div>
            </div>
          </div>

          <Show when={props.footer}>
            <footer class={modalFooterClasses()}>{props.footer}</footer>
          </Show>
        </div>
      </div>
    </Show>
  );
};
