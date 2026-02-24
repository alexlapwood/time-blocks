import {
  type Component,
  Show,
  For,
  createEffect,
  createSignal,
  on,
} from "solid-js";
import { cva } from "class-variance-authority";
import {
  CATEGORY_OPTIONS,
  type CategoryId,
  useTaskStore,
} from "../store/taskStore";

const CATEGORY_COLORS: Record<CategoryId, string> = {
  red: "var(--category-red)",
  orange: "var(--category-orange)",
  yellow: "var(--category-yellow)",
  green: "var(--category-green)",
  greenblue: "var(--category-greenblue)",
  blue: "var(--category-blue)",
  purple: "var(--category-purple)",
};

const resolveCategorySwatchColor = (category: CategoryId | null | undefined) =>
  category ? CATEGORY_COLORS[category] : "var(--surface-solid)";

const textInputBase =
  "w-full rounded-(--radius-input) border-2 border-(--outline) bg-(--text-input-bg) px-[0.9rem] py-[0.65rem] font-body font-medium shadow-(--shadow-tile) transition-[transform,box-shadow,border-color] [transition-duration:var(--speed-base)] focus-visible:-translate-y-px focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color,#ffffff)] focus-visible:outline-offset-[var(--focus-ring-width)]";

const comboWrapperClasses = cva("flex items-center gap-3");

const comboAnchorClasses = cva("relative min-w-[240px] flex-1");

const inputClasses = cva(`${textInputBase} min-w-0 pr-[2.6rem]`);

const caretClasses = cva(
  "pointer-events-none absolute right-4 top-1/2 h-[0.48rem] w-[0.48rem] -translate-y-[70%] rotate-45 border-b-2 border-r-2 border-(--ink-muted) opacity-[0.85]",
);

const menuClasses = cva(
  "m-0 grid max-h-[240px] gap-[0.2rem] overflow-y-auto rounded-[14px] border-2 border-(--outline) bg-(--surface-solid) p-[0.35rem] shadow-(--shadow-soft) [overscroll-behavior:contain] [scrollbar-gutter:auto] [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink-muted)_58%,transparent)_transparent] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_srgb,var(--ink-muted)_58%,transparent)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[color-mix(in_srgb,var(--ink-muted)_74%,transparent)]",
);

const optionClasses = cva(
  "flex cursor-pointer items-center gap-[0.6rem] rounded-[10px] border px-[0.6rem] py-[0.45rem] text-left font-medium text-(--ink) transition-colors",
  {
    variants: {
      active: {
        true: "border-(--outline) bg-[color-mix(in_srgb,var(--brand)_18%,transparent)]",
        false:
          "border-transparent bg-transparent hover:border-(--outline-faint) hover:bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

const optionLabelClasses = cva("flex-1");

const swatchClasses = cva(
  "rounded-full border-2 border-(--outline) shadow-(--shadow-tile)",
  {
    variants: {
      size: {
        sm: "h-[0.7rem] w-[0.7rem] border",
        md: "h-4 w-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const ALL_IDS: (CategoryId | null)[] = [
  null,
  ...CATEGORY_OPTIONS.map((o) => o.id),
];

export const CategoryCombo: Component<{
  id: string;
  value: () => CategoryId | null;
  onSelect: (category: CategoryId | null) => void;
}> = (props) => {
  const [state, actions] = useTaskStore();

  const [inputText, setInputText] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);

  const anchorName = () => `--${props.id}-anchor`;
  const listId = () => `${props.id}-list`;

  const resolveLabel = (id: CategoryId) => {
    const option = CATEGORY_OPTIONS.find((entry) => entry.id === id);
    if (!option) return "";
    return state.categoryLabels[id] || option.label;
  };

  const resolveDefaultLabel = (id: CategoryId) =>
    CATEGORY_OPTIONS.find((entry) => entry.id === id)?.label ?? "";

  createEffect(
    on(
      () => props.value(),
      (current) => {
        if (!current) {
          setInputText("");
          return;
        }
        setInputText(resolveLabel(current));
      },
    ),
  );

  createEffect(() => {
    props.value();
    if (!isOpen()) return;
    requestAnimationFrame(() => {
      const active = document
        .getElementById(listId())
        ?.querySelector('[data-active="true"]');
      active?.scrollIntoView({ block: "nearest" });
    });
  });

  return (
    <div class={comboWrapperClasses()}>
      <div class={comboAnchorClasses()} style={{ "anchor-name": anchorName() }}>
        <input
          id={props.id}
          class={inputClasses()}
          role="combobox"
          aria-expanded={isOpen()}
          aria-controls={listId()}
          aria-autocomplete="none"
          placeholder={
            props.value() ? resolveDefaultLabel(props.value()!) : "No category"
          }
          value={inputText()}
          onFocus={() => setIsOpen(true)}
          onPointerUp={() => {
            if (window.getSelection()?.isCollapsed !== false) {
              setIsOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && isOpen()) {
              event.stopPropagation();
              setIsOpen(false);
              const current = props.value();
              setInputText(current ? resolveLabel(current) : "");
              return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            setIsOpen(true);
            const idx = ALL_IDS.indexOf(props.value());
            const step = event.key === "ArrowDown" ? 1 : -1;
            const nextId =
              ALL_IDS[(idx + step + ALL_IDS.length) % ALL_IDS.length];
            props.onSelect(nextId);
            setInputText(nextId ? resolveLabel(nextId) : "");
          }}
          onBlur={() => {
            setIsOpen(false);
            const current = props.value();
            setInputText(current ? resolveLabel(current) : "");
          }}
          onInput={(event) => {
            const current = props.value();
            const nextValue = event.currentTarget.value;
            setInputText(nextValue);
            if (!current) return;
            const defaultLabel = resolveDefaultLabel(current);
            const trimmed = nextValue.trim();
            if (!trimmed || trimmed === defaultLabel) {
              actions.updateCategoryLabel(current, "");
              return;
            }
            actions.updateCategoryLabel(current, nextValue);
          }}
        />
        <span class={caretClasses()} aria-hidden="true" />
        <Show when={isOpen()}>
          <div
            ref={(el) => requestAnimationFrame(() => el.showPopover())}
            id={listId()}
            class={menuClasses()}
            role="listbox"
            popover="manual"
            style={{
              "position-anchor": anchorName(),
              inset: "unset",
              top: "anchor(bottom)",
              left: "anchor(left)",
              width: "anchor-size(width)",
              "margin-top": "8px",
            }}
          >
            <button
              type="button"
              class={optionClasses({ active: !props.value() })}
              data-active={props.value() ? undefined : "true"}
              onPointerDown={(event) => {
                event.preventDefault();
                props.onSelect(null);
                setInputText("");
                setIsOpen(false);
              }}
            >
              <span
                class={swatchClasses({ size: "sm" })}
                style={{ background: resolveCategorySwatchColor(null) }}
              />
              <span class={optionLabelClasses()}>No category</span>
            </button>
            <For each={CATEGORY_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  class={optionClasses({
                    active: props.value() === option.id,
                  })}
                  data-active={props.value() === option.id ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    props.onSelect(option.id);
                    setInputText(resolveLabel(option.id));
                    setIsOpen(false);
                  }}
                >
                  <span
                    class={swatchClasses({ size: "sm" })}
                    data-category={option.id}
                    style={{
                      background: resolveCategorySwatchColor(option.id),
                    }}
                  />
                  <span class={optionLabelClasses()}>
                    {resolveLabel(option.id)}
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div
        class={swatchClasses()}
        data-category={props.value() ?? undefined}
        aria-hidden="true"
        style={{ background: resolveCategorySwatchColor(props.value()) }}
      />
    </div>
  );
};
