import { describe, expect, it } from "vitest";
import { ceilToFifteen, stampRoutine } from "./routineStamping";

describe("stampRoutine", () => {
  it("returns no stamps when the routine is empty", () => {
    const stamps = stampRoutine({
      items: [],
      todayWeekday: 1,
      nowFloorMinutes: 9 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([]);
  });

  it("stamps a single item whose home day is today at the now-floor", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "workout",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 45,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 9 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "workout", startMinutes: 9 * 60, duration: 45 },
    ]);
  });

  it("anchors the first wave at the template time when the now-floor is earlier than the template start", () => {
    // Previewing a future day or an early-morning Start Day press: the
    // routine should appear at its templated time, not slammed to the
    // (earlier) now-floor.
    const stamps = stampRoutine({
      items: [
        {
          id: "workout",
          homeDay: 1,
          startMinutes: 9 * 60,
          duration: 45,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 6 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "workout", startMinutes: 9 * 60, duration: 45 },
    ]);
  });

  it("excludes items whose home day does not match today", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "saturday-yoga",
          homeDay: 6,
          startMinutes: 8 * 60,
          duration: 30,
        },
        {
          id: "monday-workout",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 45,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 9 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "monday-workout", startMinutes: 9 * 60, duration: 45 },
    ]);
  });

  it("stamps an item whose home day differs from today but whose repeat days include today", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "weekday-workout",
          homeDay: 1, // Monday
          startMinutes: 7 * 60,
          duration: 30,
          repeatDays: [2, 3, 4, 5], // Tue–Fri
        },
      ],
      todayWeekday: 3, // Wednesday
      nowFloorMinutes: 9 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "weekday-workout", startMinutes: 9 * 60, duration: 30 },
    ]);
  });

  it("excludes items whose home day differs from today and whose repeat days do not include today", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "weekend-only",
          homeDay: 6, // Saturday
          startMinutes: 8 * 60,
          duration: 30,
          repeatDays: [0], // also Sunday
        },
      ],
      todayWeekday: 3, // Wednesday
      nowFloorMinutes: 9 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([]);
  });

  it("stamps a home-day item alongside a repeat-day item when today matches both", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "wednesday-home",
          homeDay: 3, // Wednesday
          startMinutes: 7 * 60,
          duration: 30,
        },
        {
          id: "weekday-repeat",
          homeDay: 1, // Monday home, but repeats Wed
          startMinutes: 8 * 60,
          duration: 30,
          repeatDays: [3],
        },
      ],
      todayWeekday: 3,
      nowFloorMinutes: 7 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "wednesday-home", startMinutes: 7 * 60, duration: 30 },
      { templateItemId: "weekday-repeat", startMinutes: 8 * 60, duration: 30 },
    ]);
  });

  it("packs contiguous template items as a single wave from the now-floor", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "workout",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 45,
        },
        {
          id: "stretch",
          homeDay: 1,
          startMinutes: 7 * 60 + 45,
          duration: 15,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 9 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "workout", startMinutes: 9 * 60, duration: 45 },
      { templateItemId: "stretch", startMinutes: 9 * 60 + 45, duration: 15 },
    ]);
  });

  it("starts a later wave at its template anchor when a gap separates it from the previous wave", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "workout",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 30,
        },
        {
          id: "deep-work",
          homeDay: 1,
          startMinutes: 13 * 60,
          duration: 60,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 8 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "workout", startMinutes: 8 * 60, duration: 30 },
      { templateItemId: "deep-work", startMinutes: 13 * 60, duration: 60 },
    ]);
  });

  it("falls a later wave forward when an earlier wave bleeds past its template anchor", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "morning-block",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 4 * 60,
        },
        {
          id: "afternoon-block",
          homeDay: 1,
          startMinutes: 13 * 60,
          duration: 60,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 11 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      {
        templateItemId: "morning-block",
        startMinutes: 11 * 60,
        duration: 4 * 60,
      },
      {
        templateItemId: "afternoon-block",
        startMinutes: 15 * 60,
        duration: 60,
      },
    ]);
  });

  it("pushes a wave's first item later until it clears a conflict at the anchor", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "workout",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 60,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 9 * 60,
      conflicts: [
        {
          startMinutes: 9 * 60,
          duration: 30,
        },
      ],
    });

    expect(stamps).toEqual([
      { templateItemId: "workout", startMinutes: 9 * 60 + 30, duration: 60 },
    ]);
  });

  it("jumps a mid-wave item past a conflict and continues packing from there", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "warmup",
          homeDay: 1,
          startMinutes: 7 * 60,
          duration: 30,
        },
        {
          id: "workout",
          homeDay: 1,
          startMinutes: 7 * 60 + 30,
          duration: 30,
        },
        {
          id: "shower",
          homeDay: 1,
          startMinutes: 8 * 60,
          duration: 15,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 9 * 60,
      conflicts: [
        {
          startMinutes: 9 * 60 + 30,
          duration: 30,
        },
      ],
    });

    expect(stamps).toEqual([
      { templateItemId: "warmup", startMinutes: 9 * 60, duration: 30 },
      { templateItemId: "workout", startMinutes: 10 * 60, duration: 30 },
      { templateItemId: "shower", startMinutes: 10 * 60 + 30, duration: 15 },
    ]);
  });

  it("drops items that cannot fit before midnight without affecting earlier items", () => {
    const stamps = stampRoutine({
      items: [
        {
          id: "evening-block",
          homeDay: 1,
          startMinutes: 22 * 60,
          duration: 60,
        },
        {
          id: "overnight-block",
          homeDay: 1,
          startMinutes: 23 * 60,
          duration: 120,
        },
      ],
      todayWeekday: 1,
      nowFloorMinutes: 23 * 60,
      conflicts: [],
    });

    expect(stamps).toEqual([
      { templateItemId: "evening-block", startMinutes: 23 * 60, duration: 60 },
    ]);
  });
});

describe("ceilToFifteen", () => {
  it("snaps a minute already on a 15-minute boundary to itself", () => {
    expect(ceilToFifteen(0)).toBe(0);
    expect(ceilToFifteen(15)).toBe(15);
    expect(ceilToFifteen(8 * 60)).toBe(8 * 60);
  });

  it("rounds a minute strictly between two boundaries up to the next boundary", () => {
    expect(ceilToFifteen(1)).toBe(15);
    expect(ceilToFifteen(14)).toBe(15);
    expect(ceilToFifteen(10 * 60 + 7)).toBe(10 * 60 + 15);
    expect(ceilToFifteen(10 * 60 + 14)).toBe(10 * 60 + 15);
  });
});
