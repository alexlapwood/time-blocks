import { type Component, Show } from "solid-js";
import { cva } from "class-variance-authority";

export type StartDayMode = "now" | "on-time";

const backdropClasses = cva(
  "fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_75%,transparent)] p-6 backdrop-blur-[10px]",
);

const cardClasses = cva(
  "flex w-full max-w-[460px] flex-col overflow-hidden rounded-(--radius-card) border-2 border-(--outline) bg-(--surface) shadow-(--shadow-pop)",
);

const headerClasses = cva(
  "flex items-start justify-between gap-4 border-b border-(--outline-soft) px-[1.6rem] pb-4 pt-6",
);

const closeButtonClasses = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-(--outline) bg-(--surface-solid) px-[0.9rem] py-[0.4rem] font-body text-[0.82rem] font-medium leading-none tracking-[0.02em] text-(--ink-muted) transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--brand)_30%,var(--outline))] hover:text-(--ink) hover:shadow-[0_2px_6px_color-mix(in_srgb,var(--brand)_12%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
);

const optionButtonClasses = cva(
  "flex w-full cursor-pointer flex-col gap-[0.2rem] rounded-(--radius-input) border-2 border-(--outline) bg-(--surface-solid) px-[1.2rem] py-[0.9rem] text-left transition-[transform,box-shadow,border-color,background,color] [transition-duration:var(--speed-fast)] hover:-translate-y-px hover:shadow-[0_2px_10px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,_#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]",
  {
    variants: {
      tone: {
        primary:
          "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--surface-solid))] hover:border-(--brand) hover:shadow-[0_4px_14px_color-mix(in_srgb,var(--brand)_25%,transparent)]",
        neutral:
          "hover:border-[color-mix(in_srgb,var(--brand)_30%,var(--outline))]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

const optionTitleClasses = cva(
  "font-body text-[0.95rem] font-semibold tracking-[0.01em] text-(--ink)",
);

const optionHintClasses = cva("font-body text-[0.8rem] text-(--ink-muted)");

export const StartDayModal: Component<{
  open: boolean;
  onClose: () => void;
  onStart: (mode: StartDayMode) => void;
}> = (props) => {
  return (
    <Show when={props.open}>
      <div
        class={backdropClasses()}
        role="dialog"
        aria-modal="true"
        aria-label="Start day"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <div class={cardClasses()}>
          <header class={headerClasses()}>
            <div>
              <div class="mb-[0.35rem] text-[0.7rem] font-medium uppercase tracking-[0.2em] text-(--ink-soft)">
                Start day
              </div>
              <h3 class="m-0 font-display text-[1.4rem] text-(--ink)">
                How do you want to start?
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

          <div class="flex flex-col gap-3 px-[1.6rem] pb-[1.4rem] pt-[1.2rem]">
            <button
              type="button"
              class={optionButtonClasses({ tone: "primary" })}
              onClick={() => props.onStart("now")}
            >
              <span class={optionTitleClasses()}>Start now</span>
              <span class={optionHintClasses()}>
                Shift today's routine to begin at the current time.
              </span>
            </button>
            <button
              type="button"
              class={optionButtonClasses({ tone: "neutral" })}
              onClick={() => props.onStart("on-time")}
            >
              <span class={optionTitleClasses()}>Start on time</span>
              <span class={optionHintClasses()}>
                Keep your routine's originally scheduled times.
              </span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
