// How the Today view groups items. Pure, so the browser and the server share it.
import { addDays } from "@/lib/dates";
import type { Item } from "./data";

export type TodayGroups<T> = { overdue: T[]; today: T[]; week: T[]; later: T[]; undated: T[] };

// True while the item waits on at least one item that is not done.
export function isWaiting(item: Pick<Item, "waitsOn">): boolean {
  return item.waitsOn.some((w) => !w.done);
}

export function todayGroups<T extends Pick<Item, "kind" | "due_date" | "done_at" | "waitsOn" | "project">>(
  items: T[],
  today: string,
): TodayGroups<T> {
  const groups: TodayGroups<T> = { overdue: [], today: [], week: [], later: [], undated: [] };
  const weekEnd = addDays(today, 7);
  for (const item of items) {
    if (item.done_at !== null) continue;
    if (isWaiting(item)) continue;
    if (item.project?.status === "archived") continue;
    if (item.kind === "idea" && item.due_date === null) continue;
    const d = item.due_date;
    if (d === null) groups.undated.push(item);
    else if (d < today) groups.overdue.push(item);
    else if (d === today) groups.today.push(item);
    else if (d <= weekEnd) groups.week.push(item);
    else groups.later.push(item);
  }
  return groups;
}
