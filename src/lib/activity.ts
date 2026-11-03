import { addDays, todayIn } from "@/lib/dates";
import type { Item } from "@/lib/items/data";
import { isWaiting } from "@/lib/items/views";

export type Day = { date: string; count: number };
export type Grid = { cells: (Day | null)[]; months: (string | null)[]; total: number; today: Day };
export type ProjectSummary = {
  next: Pick<Item, "id" | "title"> | null;
  open: number;
  latest: { title: string; done_at: string } | null;
  week: Day[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Counts done items per calendar day in the given zone.
export function doneByDay(doneAts: string[], timeZone: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const iso of doneAts) {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    const day = todayIn(timeZone, t);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

// The n days ending with today, oldest first; days with no entry count 0.
export function lastDays(counts: Map<string, number>, today: string, n: number): Day[] {
  const days: Day[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

export function level(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

// 0 = Sunday ... 6 = Saturday.
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

// Columns run Sunday to Saturday; the last column holds today. Cells are column by column.
export function yearGrid(counts: Map<string, number>, today: string, weeks: number): Grid {
  const lastSunday = addDays(today, -weekday(today));
  const first = addDays(lastSunday, -7 * (weeks - 1));
  const cells: (Day | null)[] = [];
  const months: (string | null)[] = [];
  let total = 0;
  for (let w = 0; w < weeks; w++) {
    const sunday = addDays(first, 7 * w);
    const dayOfMonth = Number(sunday.slice(8, 10));
    months.push(w < weeks - 2 && dayOfMonth <= 7 ? MONTHS[Number(sunday.slice(5, 7)) - 1] : null);
    for (let d = 0; d < 7; d++) {
      const date = addDays(sunday, d);
      if (date > today) {
        cells.push(null);
        continue;
      }
      const count = counts.get(date) ?? 0;
      total += count;
      cells.push({ date, count });
    }
  }
  return { cells, months, total, today: { date: today, count: counts.get(today) ?? 0 } };
}

// Totals per calendar month, oldest first, labelled like "Nov 2026".
export function monthTotals(days: Day[]): { month: string; count: number }[] {
  const out: { month: string; count: number }[] = [];
  let key = "";
  for (const d of days) {
    const k = d.date.slice(0, 7);
    if (k !== key) {
      key = k;
      out.push({ month: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, count: 0 });
    }
    out[out.length - 1].count += d.count;
  }
  return out;
}

export function projectSummary(
  items: Pick<Item, "id" | "title" | "kind" | "done_at" | "due_date" | "due_time" | "created_at" | "waitsOn">[],
  today: string,
  timeZone: string,
): ProjectSummary {
  const open = items.filter((i) => i.done_at === null);
  const nextItem = open.find((i) => i.kind !== "idea" && !isWaiting(i));
  let latest: { title: string; done_at: string } | null = null;
  const doneAts: string[] = [];
  for (const i of items) {
    if (i.done_at === null) continue;
    doneAts.push(i.done_at);
    if (latest === null || i.done_at > latest.done_at) latest = { title: i.title, done_at: i.done_at };
  }
  return {
    next: nextItem ? { id: nextItem.id, title: nextItem.title } : null,
    open: open.length,
    latest,
    week: lastDays(doneByDay(doneAts, timeZone), today, 7),
  };
}
