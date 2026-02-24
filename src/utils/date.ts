export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDate(value?: Date | string | null) {
  if (!value) return null;
  return typeof value === "string" ? new Date(value) : value;
}

export function getLocalDateId(value?: Date | string | null) {
  const date = toDate(value);
  return date ? formatLocalDate(date) : null;
}

export function getMinutesInDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function buildDateAtMinutes(baseDate: Date, minutes: number) {
  const next = new Date(baseDate);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
}
