import { describe, expect, it } from "vitest";
import tailwindConfig from "../tailwind.config";

describe("tailwind dashboard breakpoints", () => {
  it("uses the two-column layout for wide or tall viewports", () => {
    expect(
      tailwindConfig.theme?.extend?.screens?.["dashboard-two-col"],
    ).toEqual({
      raw: "(min-width: 900px), (max-aspect-ratio: 1/1)",
    });
  });

  it("limits the wide dashboard layouts to landscape viewports", () => {
    expect(
      tailwindConfig.theme?.extend?.screens?.["dashboard-wide-two"],
    ).toEqual({
      raw: "(min-width: 1200px) and (min-aspect-ratio: 1001/1000)",
    });
    expect(
      tailwindConfig.theme?.extend?.screens?.["dashboard-wide-three"],
    ).toEqual({
      raw: "(min-width: 1600px) and (min-aspect-ratio: 1001/1000)",
    });
    expect(
      tailwindConfig.theme?.extend?.screens?.["dashboard-wide-four"],
    ).toEqual({
      raw: "(min-width: 1800px) and (min-aspect-ratio: 1001/1000)",
    });
  });
});
