import { type Component } from "solid-js";
import { componentThemeClasses } from "../themes/index";

export const ADD_CARD_BUTTON_CLASSES = [
  "w-full cursor-pointer rounded-full border-2 border-[color-mix(in_srgb,var(--brand)_35%,var(--outline))]",
  "bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface-solid))] px-4 py-[0.55rem]",
  "text-center font-body text-[0.88rem] font-medium tracking-[0.02em] text-[var(--ink)]",
  "shadow-none transition-[transform,box-shadow,border-color,background] duration-150 ease-out",
  "hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--brand)_55%,var(--outline))]",
  "hover:bg-[color-mix(in_srgb,var(--brand)_14%,var(--surface-solid))]",
  "hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--brand)_18%,transparent)]",
  "active:translate-y-0",
  "focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)]",
  "focus-visible:outline-offset-[var(--focus-ring-width)]",
  componentThemeClasses.board.addCard,
].join(" ");

export const AddCardButton: Component<{
  label: string;
  ariaLabel?: string;
  onClick: () => void;
}> = (props) => {
  return (
    <button
      type="button"
      class={ADD_CARD_BUTTON_CLASSES}
      onClick={props.onClick}
      aria-label={props.ariaLabel ?? props.label}
    >
      {props.label}
    </button>
  );
};
