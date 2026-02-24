import { describe, it, expect, beforeEach } from "vitest";
import { createCalendarStore } from "./calendarStore";

describe("calendarStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize with default state", () => {
    const [state] = createCalendarStore();

    expect(state.accessToken).toBeNull();
    expect(state.events).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
