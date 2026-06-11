import { describe, it, expect, beforeEach } from "vitest";
import { THEMES, applyTheme } from "../theme";

describe("Sunset Theme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("should have sunset theme registered in THEMES", () => {
    const sunsetTheme = THEMES.find((theme) => theme.id === "sunset");
    expect(sunsetTheme).toBeDefined();
    expect(sunsetTheme?.label).toBe("Sunset");
  });

  it("should apply sunset theme to document.documentElement", () => {
    // Under vitest/jsdom, applyTheme will execute and update the dataset
    applyTheme("sunset" as any); // Cast as any because it's not in the ThemeId type union yet
    expect(document.documentElement.getAttribute("data-theme")).toBe("sunset");
  });
});
