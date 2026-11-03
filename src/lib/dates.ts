// Small date helpers. Pure, so they work in the browser and on the server.
// Dates are 'YYYY-MM-DD' text; there is no time-of-day or zone math beyond todayIn.

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Today's calendar date in the given zone. An invalid zone means UTC.
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const zone = isTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function addDays(date: string, n: number): string {
  const m = DATE.exec(date);
  if (!m) return date;
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return t.toISOString().slice(0, 10);
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
export function isTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}
