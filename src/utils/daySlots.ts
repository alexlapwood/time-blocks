import type { CalendarDraftSlot, CategoryId, Task } from "../store/taskStore";
import type { ExternalEvent } from "../store/calendarStore";
import type { CalendarSlot } from "./dragPreview";
import { formatLocalDate, getLocalDateId } from "./date";

const DEFAULT_SLOT_DURATION = 30;

export type RealSlotsInput = {
  tasks: Task[];
  draftSlots: CalendarDraftSlot[];
  externalEvents: ExternalEvent[];
};

function collectTaskSlots(
  tasks: Task[],
  dateStr: string,
  slots: CalendarSlot[],
  inheritedCategory?: CategoryId | null,
) {
  for (const task of tasks) {
    const effectiveCategory = task.category ?? inheritedCategory ?? null;
    for (const slot of task.scheduledTimes) {
      if (getLocalDateId(slot.start) !== dateStr) continue;
      slots.push({
        id: slot.id,
        taskId: task.id,
        slotType: "task",
        title: task.title,
        category: effectiveCategory,
        scheduledTime: slot.start,
        duration: slot.duration ?? DEFAULT_SLOT_DURATION,
      });
    }
    if (task.subtasks.length > 0) {
      collectTaskSlots(task.subtasks, dateStr, slots, effectiveCategory);
    }
  }
}

export function collectRealSlotsForDate(
  date: Date,
  input: RealSlotsInput,
): CalendarSlot[] {
  const dateStr = formatLocalDate(date);
  const slots: CalendarSlot[] = [];
  collectTaskSlots(input.tasks, dateStr, slots);
  for (const slot of input.draftSlots) {
    if (getLocalDateId(slot.start) !== dateStr) continue;
    slots.push({
      id: slot.id,
      taskId: slot.id,
      slotType: "draft",
      title: slot.title,
      category: slot.category ?? null,
      scheduledTime: slot.start,
      duration: slot.duration ?? DEFAULT_SLOT_DURATION,
      templateItemId: slot.templateItemId,
    });
  }
  for (const event of input.externalEvents) {
    if (getLocalDateId(event.start) !== dateStr) continue;
    slots.push({
      id: event.id,
      taskId: event.id,
      slotType: "external",
      title: event.title,
      category: null,
      scheduledTime: event.start,
      duration: event.duration,
    });
  }
  return slots;
}
