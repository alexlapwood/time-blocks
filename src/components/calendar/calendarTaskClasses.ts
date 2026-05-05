import { cva } from "class-variance-authority";

// Class definitions for the rounded calendar/routine tile.
//
// The same CVA backs both the day-grid calendar and the weekly routine
// canvas, so a styling fix to the selection ring, the resize edge, the
// category tints, the ghost outline, etc. lands in both at once. Variants
// the routine canvas does not exercise (e.g. "ghost" for drag previews)
// remain available for the calendar without forcing the routine to
// duplicate the chrome.
export type CalendarTaskCategory =
  | "none"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "greenblue"
  | "blue"
  | "purple";

export type CalendarTaskVariant = "normal" | "ghost" | "resizing";

export const calendarTaskClasses = cva("rounded-[16px] [--resize-edge:10px]", {
  variants: {
    variant: {
      normal:
        "border-2 border-(--outline) bg-(--calendar-task-bg) shadow-[var(--shadow-tile),var(--calendar-task-glow)] data-[selected=true]:shadow-[var(--shadow-tile),var(--calendar-task-glow),0_0_0_3px_color-mix(in_srgb,var(--accent)_70%,transparent)] data-[selected=true]:outline data-[selected=true]:outline-2 data-[selected=true]:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)] data-[selected=true]:[-outline-offset:1px]",
      ghost:
        "border-2 border-dashed border-(--outline) bg-(--calendar-task-ghost-bg) text-(--ink-muted) shadow-[var(--shadow-tile),var(--calendar-task-glow)]",
      resizing:
        "border-2 border-dashed border-(--outline) bg-(--calendar-task-resize-bg) text-(--ink-muted) shadow-[var(--shadow-tile),var(--calendar-task-glow)]",
    },
    past: {
      true: "opacity-60 saturate-75",
      false: "",
    },
    compact: {
      true: "[--resize-edge:4px] overflow-visible",
      false: "",
    },
    category: {
      none: "",
      red: "",
      orange: "",
      yellow: "",
      green: "",
      greenblue: "",
      blue: "",
      purple: "",
    },
  },
  compoundVariants: [
    {
      variant: "normal",
      category: "red",
      class:
        "border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-red)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "red",
      class:
        "bg-[color-mix(in_srgb,var(--category-red)_14%,transparent)] border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "red",
      class:
        "bg-[color-mix(in_srgb,var(--category-red)_18%,transparent)] border-[color-mix(in_srgb,var(--category-red)_55%,var(--outline))]",
    },
    {
      variant: "normal",
      category: "orange",
      class:
        "border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-orange)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "orange",
      class:
        "bg-[color-mix(in_srgb,var(--category-orange)_14%,transparent)] border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "orange",
      class:
        "bg-[color-mix(in_srgb,var(--category-orange)_18%,transparent)] border-[color-mix(in_srgb,var(--category-orange)_55%,var(--outline))]",
    },
    {
      variant: "normal",
      category: "yellow",
      class:
        "border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-yellow)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "yellow",
      class:
        "bg-[color-mix(in_srgb,var(--category-yellow)_14%,transparent)] border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "yellow",
      class:
        "bg-[color-mix(in_srgb,var(--category-yellow)_18%,transparent)] border-[color-mix(in_srgb,var(--category-yellow)_55%,var(--outline))]",
    },
    {
      variant: "normal",
      category: "green",
      class:
        "border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-green)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "green",
      class:
        "bg-[color-mix(in_srgb,var(--category-green)_14%,transparent)] border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "green",
      class:
        "bg-[color-mix(in_srgb,var(--category-green)_18%,transparent)] border-[color-mix(in_srgb,var(--category-green)_55%,var(--outline))]",
    },
    {
      variant: "normal",
      category: "greenblue",
      class:
        "border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-greenblue)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "greenblue",
      class:
        "bg-[color-mix(in_srgb,var(--category-greenblue)_14%,transparent)] border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "greenblue",
      class:
        "bg-[color-mix(in_srgb,var(--category-greenblue)_18%,transparent)] border-[color-mix(in_srgb,var(--category-greenblue)_55%,var(--outline))]",
    },
    {
      variant: "normal",
      category: "blue",
      class:
        "border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-blue)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "blue",
      class:
        "bg-[color-mix(in_srgb,var(--category-blue)_14%,transparent)] border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "blue",
      class:
        "bg-[color-mix(in_srgb,var(--category-blue)_18%,transparent)] border-[color-mix(in_srgb,var(--category-blue)_55%,var(--outline))]",
    },
    {
      variant: "normal",
      category: "purple",
      class:
        "border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))] bg-[color-mix(in_srgb,var(--category-purple)_26%,transparent)]",
    },
    {
      variant: "ghost",
      category: "purple",
      class:
        "bg-[color-mix(in_srgb,var(--category-purple)_14%,transparent)] border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))]",
    },
    {
      variant: "resizing",
      category: "purple",
      class:
        "bg-[color-mix(in_srgb,var(--category-purple)_18%,transparent)] border-[color-mix(in_srgb,var(--category-purple)_55%,var(--outline))]",
    },
  ],
  defaultVariants: {
    variant: "normal",
    past: false,
    compact: false,
    category: "none",
  },
});

export const calendarTaskTitleClasses = cva(
  "leading-[1.15] relative z-[2] pointer-events-none",
  {
    variants: {
      variant: {
        normal: "",
        ghost: "text-(--ink-muted)",
        resizing: "text-(--ink-muted)",
      },
      compact: {
        true: "absolute top-1/2 left-[10px] right-[10px] p-0 text-[0.65rem] leading-none -translate-y-1/2",
        false: "px-[0.45rem] py-[0.25rem]",
      },
      roomy: {
        true: "px-[0.55rem] py-[0.5rem]",
        false: "",
      },
      halfHourPlus: {
        true: "py-[7px]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "normal",
      compact: false,
      roomy: false,
      halfHourPlus: false,
    },
  },
);
