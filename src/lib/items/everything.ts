// The Everything view's search and filters. Pure, so the browser and the server share it.
import { isProjectId } from "@/lib/projects/input";
import type { Item } from "./data";
import { isItemKind, type ItemKind } from "./input";

export type EverythingFilter = { q: string; kind: ItemKind | "all"; status: "all" | "open" | "done"; project: "all" | "inbox" | "archived" | string };
export const DEFAULT_FILTER: EverythingFilter = { q: "", kind: "all", status: "all", project: "all" };

type Params = Record<string, string | string[] | undefined>;
function first(params: Params, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseEverythingFilter(params: Params): EverythingFilter {
  const kind = first(params, "kind");
  const status = first(params, "status");
  const project = first(params, "project");
  return {
    q: (first(params, "q") ?? "").trim().slice(0, 100),
    kind: isItemKind(kind) ? kind : "all",
    status: status === "open" || status === "done" ? status : "all",
    project: project === "inbox" || project === "archived" || isProjectId(project) ? project : "all",
  };
}

export function filterEverything<T extends Pick<Item, "title" | "notes" | "kind" | "done_at" | "project_id" | "project">>(items: T[], f: EverythingFilter): T[] {
  const q = f.q.toLowerCase();
  const kept = items.filter((i) => {
    if (q && !i.title.toLowerCase().includes(q) && !(i.notes ?? "").toLowerCase().includes(q)) return false;
    if (f.kind !== "all" && i.kind !== f.kind) return false;
    if (f.status === "open" && i.done_at !== null) return false;
    if (f.status === "done" && i.done_at === null) return false;
    if (f.project === "all") return i.project?.status !== "archived";
    if (f.project === "inbox") return i.project_id === null;
    if (f.project === "archived") return i.project?.status === "archived";
    return i.project_id === f.project;
  });
  const open = kept.filter((i) => i.done_at === null);
  const done = kept.filter((i) => i.done_at !== null).sort((a, b) => (a.done_at! < b.done_at! ? 1 : a.done_at! > b.done_at! ? -1 : 0));
  return [...open, ...done];
}
