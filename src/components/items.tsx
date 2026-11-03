import Link from "next/link";
import { addDays } from "@/lib/dates";
import { getItem, isWaiting, type Item } from "@/lib/items/data";
import { KIND_LABEL, isItemId } from "@/lib/items/input";
import { listProjects } from "@/lib/projects/data";
import { AppFrame } from "./app-frame";
import { Icon, type IconName } from "./icons";
import { ItemCheck } from "./item-check";

export type PickerProject = { id: string; name: string };

// Projects offered in pickers: active and paused. Archived projects leave them (spec P7).
export async function pickerProjects(): Promise<PickerProject[]> {
  const all = await listProjects();
  return all.ok ? all.value.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, name: p.name })) : [];
}

const KIND_ICON: Partial<Record<Item["kind"], IconName>> = { reminder: "bell", idea: "idea", feature: "feature" };

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  const d = new Date(`${date}T00:00:00Z`);
  if (date > today && date <= addDays(today, 6)) return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric", timeZone: "UTC" });
}

// When an item is due, in words, and how urgent: late (red) or today with a time (amber).
// Late items outside the Overdue group say "Overdue" in words, so colour never carries it alone.
export function dueText(item: Pick<Item, "due_date" | "due_time" | "done_at">, today: string, inOverdueGroup = false) {
  if (!item.due_date) return { text: "", tone: "" };
  const late = item.done_at === null && item.due_date < today;
  const day = item.due_date === today && item.due_time ? "" : dayLabel(item.due_date, today);
  const text = [late && !inOverdueGroup ? "Overdue" : "", day, item.due_time ?? ""].filter(Boolean).join(" · ");
  const tone = item.done_at !== null ? "" : late ? "late" : item.due_date === today && item.due_time ? "soon" : "";
  return { text, tone };
}

export function ItemRow({
  item,
  today,
  hideProject = false,
  inOverdueGroup = false,
  extra,
}: {
  item: Item;
  today: string;
  hideProject?: boolean;
  inOverdueGroup?: boolean;
  extra?: React.ReactNode;
}) {
  const waitingOn = item.waitsOn.filter((w) => !w.done).map((w) => w.title);
  const icon = KIND_ICON[item.kind];
  const due = dueText(item, today, inOverdueGroup);
  const done = item.done_at !== null;
  return (
    <li className={done ? "row done" : "row"}>
      <ItemCheck id={item.id} title={item.title} done={done} />
      <span className="row-main">
        <Link className="title" href={`/items/${item.id}`}>
          {item.title}
        </Link>
        {!done && isWaiting(item) && (
          <span className="waiting">
            <Icon name="wait" />
            Waiting on: {waitingOn.join(", ")}
          </span>
        )}
      </span>
      {icon && (
        <span className="kind" title={KIND_LABEL[item.kind]}>
          <Icon name={icon} />
          <span className="sr-only">{KIND_LABEL[item.kind]}</span>
        </span>
      )}
      {item.project && !hideProject && (
        <Link className="proj" href={`/projects/${item.project.id}`}>
          {item.project.name}
        </Link>
      )}
      <span className={`due ${due.tone}`.trim()}>{due.text}</span>
      {extra}
    </li>
  );
}

export function ItemGroup({
  title,
  items,
  today,
  empty,
  tone,
  hideProject,
  extra,
}: {
  title: string;
  items: Item[];
  today: string;
  empty?: string;
  tone?: "overdue";
  hideProject?: boolean;
  extra?: (item: Item) => React.ReactNode;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <section className="group" aria-label={title}>
      <h2 className={tone ? `group-head ${tone}` : "group-head"}>
        {title} <span className="n">{items.length}</span>
      </h2>
      {items.length > 0 ? (
        <ul className="rows">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} today={today} hideProject={hideProject} inOverdueGroup={tone === "overdue"} extra={extra?.(item)} />
          ))}
        </ul>
      ) : (
        <p className="empty-row">{empty}</p>
      )}
    </section>
  );
}

// Loads an item the signed-in account can see. Bad addresses and other accounts' items both
// come back as null, so they look the same: not found.
export async function loadItem(id: string): Promise<{ item: Item | null; failed: boolean }> {
  if (!isItemId(id)) return { item: null, failed: false };
  const result = await getItem(id);
  return result.ok ? { item: result.value, failed: false } : { item: null, failed: true };
}

export function ItemNotFound({ failed }: { failed: boolean }) {
  return (
    <AppFrame current="/">
      <div className="page-head">
        <h1>{failed ? "Couldn't load the item" : "Item not found"}</h1>
      </div>
      <p className="lede">
        {failed ? "Try again in a moment." : "It may have been deleted, or the address is wrong."} <Link href="/">Back to Today</Link>
      </p>
    </AppFrame>
  );
}
