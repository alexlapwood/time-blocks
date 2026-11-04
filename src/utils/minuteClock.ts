import { createSignal, onCleanup, type Accessor } from "solid-js";

const MINUTE_MS = 60_000;

const msUntilNextMinute = (date: Date) =>
  MINUTE_MS - (date.getSeconds() * 1000 + date.getMilliseconds());

export function createMinuteClock(): Accessor<Date> {
  const [now, setNow] = createSignal(new Date());
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleTick = () => {
    timer = setTimeout(() => {
      setNow(new Date());
      scheduleTick();
    }, msUntilNextMinute(new Date()));
  };

  scheduleTick();
  onCleanup(() => clearTimeout(timer));

  return now;
}
