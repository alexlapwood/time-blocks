import { describe, it, expect, beforeEach } from "vitest";
import { THEMES, applyTheme } from "../theme";

describe("Cyberpunk Theme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("should have cyberpunk theme registered in THEMES", () => {
    const cyberpunkTheme = THEMES.find((theme) => theme.id === "cyberpunk");
    expect(cyberpunkTheme).toBeDefined();
    expect(cyberpunkTheme?.label).toBe("Cyberpunk");
  });

  it("should apply cyberpunk theme to document.documentElement", () => {
    applyTheme("cyberpunk" as any);
    expect(document.documentElement.getAttribute("data-theme")).toBe("cyberpunk");
  });
});
