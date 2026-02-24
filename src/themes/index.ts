import { THEMES, type ThemeId } from "../theme";
import type { ThemeComponentClasses } from "./types";

type ThemeClassModule = {
  themeId: ThemeId;
  classes: ThemeComponentClasses;
};

const modules = import.meta.glob("./*.theme.ts", {
  eager: true,
}) as Record<string, ThemeClassModule>;

const classesByTheme: Partial<Record<ThemeId, ThemeComponentClasses>> = {};
for (const module of Object.values(modules)) {
  classesByTheme[module.themeId] = module.classes;
}

const joinThemeClasses = (
  selector: (classes: ThemeComponentClasses) => string | undefined,
) =>
  THEMES.map((theme) => selector(classesByTheme[theme.id] ?? {}))
    .filter((classes): classes is string => typeof classes === "string")
    .filter((classes) => classes.length > 0)
    .join(" ");

export const componentThemeClasses = {
  board: {
    addCard: joinThemeClasses((classes) => classes.board?.addCard),
  },
  dashboard: {
    togglePill: joinThemeClasses((classes) => classes.dashboard?.togglePill),
    togglePillActive: joinThemeClasses(
      (classes) => classes.dashboard?.togglePillActive,
    ),
    togglePillInactive: joinThemeClasses(
      (classes) => classes.dashboard?.togglePillInactive,
    ),
  },
} as const;
