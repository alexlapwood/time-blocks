import { describe, expect, it } from "vitest";
import {
  PIXELS_PER_MINUTE,
  centerScrollTopForMinute,
} from "./calendarLayout";

describe("calendarLayout", () => {
  describe("centerScrollTopForMinute", () => {
    it("centers a mid-day target inside the viewport", () => {
      const viewportHeight = 600;
      const contentHeight = 1440;
      const targetMinutes = 12 * 60;

      const scrollTop = centerScrollTopForMinute({
        targetMinutes,
        viewportHeight,
        contentHeight,
      });

      const targetTop = targetMinutes * PIXELS_PER_MINUTE;
      expect(scrollTop + viewportHeight / 2).toBeCloseTo(targetTop);
    });

    it("clamps to 0 when the target sits inside the first half-viewport", () => {
      const scrollTop = centerScrollTopForMinute({
        targetMinutes: 30,
        viewportHeight: 600,
        contentHeight: 1440,
      });
      expect(scrollTop).toBe(0);
    });

    it("clamps to the maximum scroll when the target sits inside the last half-viewport", () => {
      const viewportHeight = 600;
      const contentHeight = 1440;
      const scrollTop = centerScrollTopForMinute({
        targetMinutes: 23 * 60 + 30,
        viewportHeight,
        contentHeight,
      });
      expect(scrollTop).toBe(contentHeight - viewportHeight);
    });

    it("returns 0 when the content fits entirely in the viewport", () => {
      const scrollTop = centerScrollTopForMinute({
        targetMinutes: 12 * 60,
        viewportHeight: 2000,
        contentHeight: 1440,
      });
      expect(scrollTop).toBe(0);
    });
  });
});
