import { describe, expect, it } from "vitest";
import { assignLanes, type LaneItem } from "./calendarLanes";

describe("assignLanes", () => {
  it("assigns lane 0 of 1 to a single event", () => {
    const items: LaneItem[] = [{ id: "a", startMinutes: 60, endMinutes: 90 }];
    const result = assignLanes(items);
    expect(result.get("a")).toEqual({ lane: 0, laneCount: 1 });
  });

  it("keeps non-overlapping events in their own single-lane groups", () => {
    const items: LaneItem[] = [
      { id: "a", startMinutes: 60, endMinutes: 90 },
      { id: "b", startMinutes: 120, endMinutes: 150 },
    ];
    const result = assignLanes(items);
    expect(result.get("a")).toEqual({ lane: 0, laneCount: 1 });
    expect(result.get("b")).toEqual({ lane: 0, laneCount: 1 });
  });

  it("splits two overlapping events into two lanes (halves)", () => {
    const items: LaneItem[] = [
      { id: "a", startMinutes: 60, endMinutes: 120 },
      { id: "b", startMinutes: 60, endMinutes: 120 },
    ];
    const result = assignLanes(items);
    const a = result.get("a")!;
    const b = result.get("b")!;
    expect(a.laneCount).toBe(2);
    expect(b.laneCount).toBe(2);
    expect(new Set([a.lane, b.lane])).toEqual(new Set([0, 1]));
  });

  it("splits three mutually overlapping events into three lanes (thirds)", () => {
    const items: LaneItem[] = [
      { id: "a", startMinutes: 60, endMinutes: 120 },
      { id: "b", startMinutes: 60, endMinutes: 120 },
      { id: "c", startMinutes: 60, endMinutes: 120 },
    ];
    const result = assignLanes(items);
    const lanes = ["a", "b", "c"].map((id) => result.get(id)!);
    expect(lanes.every((l) => l.laneCount === 3)).toBe(true);
    expect(new Set(lanes.map((l) => l.lane))).toEqual(new Set([0, 1, 2]));
  });

  it("splits four mutually overlapping events into four lanes (quarters)", () => {
    const items: LaneItem[] = [
      { id: "a", startMinutes: 60, endMinutes: 120 },
      { id: "b", startMinutes: 60, endMinutes: 120 },
      { id: "c", startMinutes: 60, endMinutes: 120 },
      { id: "d", startMinutes: 60, endMinutes: 120 },
    ];
    const result = assignLanes(items);
    const lanes = ["a", "b", "c", "d"].map((id) => result.get(id)!);
    expect(lanes.every((l) => l.laneCount === 4)).toBe(true);
    expect(new Set(lanes.map((l) => l.lane))).toEqual(new Set([0, 1, 2, 3]));
  });

  it("propagates the lane count across a transitive overlap chain", () => {
    // A overlaps B, B overlaps C, but A does not overlap C.
    // The whole chain still belongs to the same group, and each event is
    // drawn at half width because at any moment within the chain at most
    // 2 events are simultaneously visible.
    const items: LaneItem[] = [
      { id: "a", startMinutes: 0, endMinutes: 30 },
      { id: "b", startMinutes: 20, endMinutes: 50 },
      { id: "c", startMinutes: 40, endMinutes: 70 },
    ];
    const result = assignLanes(items);
    expect(result.get("a")?.laneCount).toBe(2);
    expect(result.get("b")?.laneCount).toBe(2);
    expect(result.get("c")?.laneCount).toBe(2);
    // A and C don't overlap so they can share lane 0 while B sits in lane 1.
    expect(result.get("a")?.lane).toBe(0);
    expect(result.get("b")?.lane).toBe(1);
    expect(result.get("c")?.lane).toBe(0);
  });

  it("starts a fresh group once all active lanes have ended", () => {
    const items: LaneItem[] = [
      { id: "a", startMinutes: 0, endMinutes: 30 },
      { id: "b", startMinutes: 0, endMinutes: 30 },
      { id: "c", startMinutes: 60, endMinutes: 90 },
    ];
    const result = assignLanes(items);
    expect(result.get("a")?.laneCount).toBe(2);
    expect(result.get("b")?.laneCount).toBe(2);
    expect(result.get("c")?.laneCount).toBe(1);
    expect(result.get("c")?.lane).toBe(0);
  });

  it("places earlier-starting events in earlier lanes", () => {
    const items: LaneItem[] = [
      { id: "later", startMinutes: 30, endMinutes: 90 },
      { id: "earlier", startMinutes: 0, endMinutes: 60 },
    ];
    const result = assignLanes(items);
    expect(result.get("earlier")?.lane).toBe(0);
    expect(result.get("later")?.lane).toBe(1);
  });

  it("returns an empty map for an empty input", () => {
    expect(assignLanes([])).toEqual(new Map());
  });
});
