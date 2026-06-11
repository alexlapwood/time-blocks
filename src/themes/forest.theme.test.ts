import { describe, it, expect, beforeEach } from "vitest";
import { THEMES, applyTheme } from "../theme";

describe("Forest Theme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("should have forest theme registered in THEMES", () => {
    const forestTheme = THEMES.find((theme) => theme.id === "forest");
    expect(forestTheme).toBeDefined();
    expect(forestTheme?.label).toBe("Forest");
  });

  it("should apply forest theme to document.documentElement", () => {
    applyTheme("forest" as any);
    expect(document.documentElement.getAttribute("data-theme")).toBe("forest");
  });
});
