import { type Component, Show, createMemo } from "solid-js";
import { useTaskStore } from "../store/taskStore";
import { useCalendarStore } from "../store/calendarStore";
import { collectRealSlotsForDate } from "../utils/daySlots";
import { createMinuteClock } from "../utils/minuteClock";
import {
  formatNowNextLabel,
  formatNowNextText,
  pickNowNext,
  toNowNextBlocks,
  type NowNextBlock,
} from "../utils/nowNext";

type HeaderNowNextProps = {
  onGoToBlock: (block: NowNextBlock) => void;
};

export const HeaderNowNext: Component<HeaderNowNextProps> = (props) => {
  const [state] = useTaskStore();
  const [calendarState] = useCalendarStore();
  const clock = createMinuteClock();

  const nowNext = createMemo(() => {
    const now = clock();
    // Yesterday too, so a block that started before midnight still counts as "now".
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    const input = {
      tasks: state.tasks,
      draftSlots: state.calendarDraftSlots,
      externalEvents: calendarState.events,
    };
    const slots = [yesterday, now].flatMap((date) =>
      collectRealSlotsForDate(date, input),
    );
    return pickNowNext(toNowNextBlocks(slots, state.tasks), now);
  });

  return (
    <Show when={nowNext()}>
      {(result) => (
        <div class="flex min-w-[8rem] flex-1 justify-center">
          <button
            type="button"
            data-now-next="true"
            data-state={result().kind}
            data-category={result().block.category}
            data-slot-type={result().block.slotType}
            title={result().block.title}
            aria-label={formatNowNextLabel(result())}
            class="flex min-w-0 max-w-[18rem] cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 font-body text-[0.88rem] font-medium tracking-[0.02em] text-(--ink) transition-[transform,box-shadow] duration-(--speed-fast) hover:-translate-y-px hover:shadow-[0_2px_8px_color-mix(in_srgb,var(--ink)_10%,transparent)] active:translate-y-0 focus-visible:[outline:var(--focus-ring-width)_solid_var(--focus-ring-color)] focus-visible:outline-offset-(--focus-ring-width)"
            onClick={() => props.onGoToBlock(result().block)}
          >
            <span
              data-now-next-dot="true"
              aria-hidden="true"
              class="h-2.5 w-2.5 shrink-0 rounded-full"
            />
            <span class="min-w-0 truncate">{result().block.title}</span>
            <span class="shrink-0 whitespace-nowrap tabular-nums">
              {formatNowNextText(result())}
            </span>
          </button>
        </div>
      )}
    </Show>
  );
};
