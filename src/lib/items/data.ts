import "server-only";
import { logEvent } from "@/lib/log";
import { getProject } from "@/lib/projects/data";
import type { ProjectStatus } from "@/lib/projects/input";
import { allRows } from "@/lib/supabase/all-rows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ItemInput, ItemKind } from "./input";
import { isWaiting } from "./views";

// Thin database calls for items and their "waits on" links. They run as the signed-in user, so
// row-level security decides what is visible. Errors become plain messages; database text is never passed on.
export type WaitRef = { id: string; title: string; done: boolean };
export type Item = {
  id: string;
  project_id: string | null;
  kind: ItemKind;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null; // 'HH:MM'
  done_at: string | null;
  created_at: string;
  updated_at: string;
  project: { id: string; name: string; status: ProjectStatus } | null;
  waitsOn: WaitRef[]; // every item this one waits on, done or not, ordered by title
};
export type ItemResult<T> = { ok: true; value: T } | { ok: false; message: string };

export { isWaiting };

export type ItemFilter = { project?: string; inbox?: boolean; open?: boolean; doneSince?: string };

const COLUMNS = "id, project_id, kind, title, notes, due_date, due_time, done_at, created_at, updated_at, project:projects(id,name,status)";
const GENERIC_FAILURE = "Couldn't save the item. Try again.";
const MISSING_ITEM = "That item doesn't exist.";
const CHUNK = 100;

type Failed = { ok: false; message: string };
function failure(action: string, error: { code?: string }, message = GENERIC_FAILURE): Failed {
  logEvent("items_failed", { action, code: error.code ?? "unknown" });
  return { ok: false, message };
}

type Row = Omit<Item, "waitsOn" | "due_time" | "project"> & {
  due_time: string | null;
  project: Item["project"] | Item["project"][];
};

function shape(row: Row, waitsOn: WaitRef[]): Item {
  const project = Array.isArray(row.project) ? (row.project[0] ?? null) : row.project;
  return { ...row, project, due_time: row.due_time ? row.due_time.slice(0, 5) : null, waitsOn };
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Looks up what each listed item waits on: the links, then the titles and done state of the blockers.
async function loadWaits(db: Db, ids: string[]): Promise<{ map: Map<string, WaitRef[]> } | { error: { code?: string } }> {
  const map = new Map<string, WaitRef[]>();
  if (ids.length === 0) return { map };
  const links: { item_id: string; waits_on_id: string }[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await allRows<{ item_id: string; waits_on_id: string }>((from, to) =>
      db.from("item_waits").select("item_id, waits_on_id").in("item_id", part).order("item_id").order("waits_on_id").range(from, to),
    );
    if (error) return { error };
    links.push(...data);
  }
  if (links.length === 0) return { map };
  const blockerIds = [...new Set(links.map((l) => l.waits_on_id))];
  const blockers = new Map<string, WaitRef>();
  for (const part of chunks(blockerIds)) {
    const { data, error } = await db.from("items").select("id, title, done_at").in("id", part);
    if (error) return { error };
    for (const b of data ?? []) blockers.set(b.id, { id: b.id, title: b.title, done: b.done_at !== null });
  }
  for (const l of links) {
    const ref = blockers.get(l.waits_on_id);
    if (!ref) continue;
    const list = map.get(l.item_id) ?? [];
    list.push(ref);
    map.set(l.item_id, list);
  }
  for (const list of map.values()) list.sort((x, y) => x.title.localeCompare(y.title));
  return { map };
}

export async function listItems(filter: ItemFilter = {}): Promise<ItemResult<Item[]>> {
  const db = await createSupabaseServerClient();
  const page = (from: number, to: number) => {
    let query = db.from("items").select(COLUMNS);
    if (filter.project) query = query.eq("project_id", filter.project);
    if (filter.inbox) query = query.is("project_id", null);
    if (filter.open) query = query.is("done_at", null);
    if (filter.doneSince) query = query.gte("done_at", filter.doneSince);
    // The id comes last so every page has the same order and no row is skipped or repeated.
    return query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("due_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
  };
  const { data, error } = await allRows(page);
  if (error) return failure("list", error);
  const rows = data as unknown as Row[];
  const waits = await loadWaits(db, rows.map((r) => r.id));
  if ("error" in waits) return failure("list_waits", waits.error);
  return { ok: true, value: rows.map((r) => shape(r, waits.map.get(r.id) ?? [])) };
}

export async function getItem(id: string): Promise<ItemResult<Item | null>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("items").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return failure("get", error);
  if (!data) return { ok: true, value: null };
  const waits = await loadWaits(db, [id]);
  if ("error" in waits) return failure("get_waits", waits.error);
  return { ok: true, value: shape(data as unknown as Row, waits.map.get(id) ?? []) };
}

// Checks the chosen project exists and, when moving into it, is not archived.
async function checkProject(projectId: string | null, currentProjectId: string | null): Promise<Failed | null> {
  if (projectId === null) return null;
  const found = await getProject(projectId);
  if (!found.ok) return { ok: false, message: GENERIC_FAILURE };
  if (!found.value) return { ok: false, message: "That project doesn't exist." };
  if (found.value.status === "archived" && projectId !== currentProjectId) {
    return { ok: false, message: "That project is archived. Reopen it to add items." };
  }
  return null;
}

export async function createItem(input: ItemInput): Promise<ItemResult<Item>> {
  const refused = await checkProject(input.project_id, null);
  if (refused) return refused;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("items").insert(input).select(COLUMNS).single();
  if (error) return failure("create", error);
  return { ok: true, value: shape(data as unknown as Row, []) };
}

export async function updateItem(id: string, input: ItemInput): Promise<ItemResult<Item>> {
  const db = await createSupabaseServerClient();
  const current = await db.from("items").select("project_id").eq("id", id).maybeSingle();
  if (current.error) return failure("update", current.error);
  if (!current.data) return { ok: false, message: MISSING_ITEM };
  const refused = await checkProject(input.project_id, current.data.project_id);
  if (refused) return refused;
  const { data, error } = await db.from("items").update(input).eq("id", id).select("id").maybeSingle();
  if (error) return failure("update", error);
  if (!data) return { ok: false, message: MISSING_ITEM };
  const fresh = await getItem(id);
  if (!fresh.ok) return fresh;
  return fresh.value ? { ok: true, value: fresh.value } : { ok: false, message: MISSING_ITEM };
}

export async function setItemDone(id: string, done: boolean): Promise<ItemResult<null>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("items")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return failure("done", error);
  if (!data || data.length === 0) return { ok: false, message: MISSING_ITEM };
  return { ok: true, value: null };
}

export async function deleteItem(id: string): Promise<ItemResult<null>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("items").delete().eq("id", id).select("id");
  if (error) return failure("delete", error);
  if (!data || data.length === 0) return { ok: false, message: MISSING_ITEM };
  return { ok: true, value: null };
}

export async function addWait(itemId: string, waitsOnId: string): Promise<ItemResult<null>> {
  if (itemId === waitsOnId) return { ok: false, message: "An item can't wait on itself." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("item_waits").insert({ item_id: itemId, waits_on_id: waitsOnId });
  if (error) {
    if (error.code === "23505") return { ok: true, value: null };
    if (error.code === "P0001") return failure("add_wait", error, "That would make these items wait on each other.");
    return failure("add_wait", error);
  }
  return { ok: true, value: null };
}

export async function removeWait(itemId: string, waitsOnId: string): Promise<ItemResult<null>> {
  const db = await createSupabaseServerClient();
  const { error } = await db.from("item_waits").delete().eq("item_id", itemId).eq("waits_on_id", waitsOnId);
  if (error) return failure("remove_wait", error);
  return { ok: true, value: null };
}
