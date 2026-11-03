import "server-only";
import { cookies } from "next/headers";
import { isTimeZone, todayIn } from "@/lib/dates";

// The browser reports its time zone in a cookie (see TimeZoneSync), so "today" on the server
// matches the user's own calendar. UTC until the browser has reported. The account time zone
// setting in plan slice 9 replaces this.
export const TIME_ZONE_COOKIE = "hq-tz";

export async function currentTimeZone(): Promise<string> {
  const raw = (await cookies()).get(TIME_ZONE_COOKIE)?.value ?? "";
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Not encoded; use as is.
  }
  return isTimeZone(value) ? value : "UTC";
}

export async function currentToday(): Promise<string> {
  return todayIn(await currentTimeZone());
}

// A moment in the past, as an ISO timestamp, for "done since" lists.
export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
