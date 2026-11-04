import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";
import { createMinuteClock } from "./minuteClock";

const at = (hours: number, minutes: number, seconds = 0, ms = 0) =>
  new Date(2026, 10, 2, hours, minutes, seconds, ms);

describe("createMinuteClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at(9, 30, 20));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with the current time", () => {
    createRoot((dispose) => {
      const now = createMinuteClock();
      expect(now()).toEqual(at(9, 30, 20));
      dispose();
    });
  });

  it("updates exactly at the next full minute, not before", () => {
    createRoot((dispose) => {
      const now = createMinuteClock();

      vi.advanceTimersByTime(39_999);
      expect(now()).toEqual(at(9, 30, 20));

      vi.advanceTimersByTime(1);
      expect(now()).toEqual(at(9, 31));

      vi.advanceTimersByTime(59_999);
      expect(now()).toEqual(at(9, 31));

      vi.advanceTimersByTime(1);
      expect(now()).toEqual(at(9, 32));

      dispose();
    });
  });

  it("stays on minute boundaries over many ticks", () => {
    createRoot((dispose) => {
      const now = createMinuteClock();

      vi.advanceTimersByTime(40_000 + 9 * 60_000);
      expect(now()).toEqual(at(9, 40));
      expect(vi.getTimerCount()).toBe(1);

      dispose();
    });
  });

  it("re-aims at the next full minute from the real time after a late tick", () => {
    createRoot((dispose) => {
      const now = createMinuteClock();

      vi.advanceTimersByTime(40_000);
      expect(now()).toEqual(at(9, 31));

      // Jump the wall clock without firing timers, as if the tick ran late.
      vi.setSystemTime(at(9, 31, 45));
      vi.advanceTimersByTime(60_000);
      expect(now()).toEqual(at(9, 32, 45));

      vi.advanceTimersByTime(14_999);
      expect(now()).toEqual(at(9, 32, 45));
      vi.advanceTimersByTime(1);
      expect(now()).toEqual(at(9, 33));

      dispose();
    });
  });

  it("stops updating after cleanup", () => {
    createRoot((dispose) => {
      const now = createMinuteClock();
      dispose();

      vi.advanceTimersByTime(5 * 60_000);
      expect(now()).toEqual(at(9, 30, 20));
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
