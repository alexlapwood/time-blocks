export type LaneItem = {
  id: string;
  startMinutes: number;
  endMinutes: number;
};

export type LaneAssignment = {
  lane: number;
  laneCount: number;
};

// Greedy lane (column) assignment for calendar events: when N events overlap
// in time they're laid out side-by-side, each occupying 1/N of the day's
// width. Events are grouped into "clusters" where each cluster's lane count
// is the maximum number of simultaneously-active events anywhere inside it,
// so events in the same cluster all share the same width even if they don't
// individually overlap every peer.
export function assignLanes(items: LaneItem[]): Map<string, LaneAssignment> {
  const result = new Map<string, LaneAssignment>();
  if (items.length === 0) return result;

  // Stable sort: items with equal (start, end) keep their relative input
  // order so callers can express "tasks before externals" simply by
  // listing tasks first.
  const sorted = [...items].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) {
      return a.startMinutes - b.startMinutes;
    }
    // Longer events first so they pin to lane 0 and shorter events fill
    // gaps to the right.
    return b.endMinutes - a.endMinutes;
  });

  let activeLaneEnds: number[] = [];
  let groupMembers: Array<{ id: string; lane: number }> = [];
  let groupLaneCount = 0;

  const finalizeGroup = () => {
    for (const { id, lane } of groupMembers) {
      result.set(id, { lane, laneCount: groupLaneCount });
    }
    groupMembers = [];
    activeLaneEnds = [];
    groupLaneCount = 0;
  };

  for (const item of sorted) {
    const groupExhausted =
      activeLaneEnds.length > 0 &&
      activeLaneEnds.every((end) => end <= item.startMinutes);
    if (groupExhausted) {
      finalizeGroup();
    }

    let lane = activeLaneEnds.findIndex((end) => end <= item.startMinutes);
    if (lane === -1) {
      lane = activeLaneEnds.length;
      activeLaneEnds.push(item.endMinutes);
    } else {
      activeLaneEnds[lane] = item.endMinutes;
    }

    groupLaneCount = Math.max(groupLaneCount, activeLaneEnds.length);
    groupMembers.push({ id: item.id, lane });
  }

  finalizeGroup();
  return result;
}
