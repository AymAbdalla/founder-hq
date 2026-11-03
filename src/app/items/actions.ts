"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isTimeZone, todayIn } from "@/lib/dates";
import { addWait, createItem, deleteItem, getItem, removeWait, setItemDone, updateItem } from "@/lib/items/data";
import { isItemId, parseItemInput } from "@/lib/items/input";
import { createProject } from "@/lib/projects/data";
import { parseProjectInput } from "@/lib/projects/input";
import { currentTimeZone } from "@/lib/time-zone";

// The add box and the edit form get a result back instead of a redirect, so they can keep
// what was typed when something goes wrong (spec P48).
export type ItemSaveResult = { ok: true; title: string; where: string | null } | { ok: false; problems: string[] };
export type DoneResult = { ok: true } | { ok: false; message: string };

// The value the add box's project picker sends for "New project…".
const NEW_PROJECT = "new";

function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

// "Today" for the person typing: the zone their browser sent with the form, else the cookie.
async function todayFor(form: FormData): Promise<string> {
  const zone = text(form, "tz");
  return todayIn(isTimeZone(zone) ? zone : await currentTimeZone());
}

function itemFields(form: FormData, project: string | undefined) {
  return { title: text(form, "title"), kind: text(form, "kind"), notes: text(form, "notes"), project, date: text(form, "date"), time: text(form, "time") };
}

export async function createItemAction(form: FormData): Promise<ItemSaveResult> {
  const today = await todayFor(form);
  const choice = text(form, "project");
  const wantsNewProject = choice === NEW_PROJECT;

  // Check the item first, so a refused item never leaves a new empty project behind.
  const parsed = parseItemInput(itemFields(form, wantsNewProject ? "" : choice), today);
  const newProject = wantsNewProject ? parseProjectInput({ name: text(form, "newProject") }) : null;
  const problems = [...(parsed.ok ? [] : parsed.problems), ...(newProject && !newProject.ok ? newProject.problems : [])];
  if (!parsed.ok || (newProject && !newProject.ok)) return { ok: false, problems };

  let projectId = parsed.value.project_id;
  if (newProject?.ok) {
    const created = await createProject(newProject.value);
    if (!created.ok) return { ok: false, problems: [created.message] };
    projectId = created.value.id;
  }
  const saved = await createItem({ ...parsed.value, project_id: projectId });
  if (!saved.ok) return { ok: false, problems: [saved.message] };
  refresh();
  return { ok: true, title: saved.value.title, where: saved.value.project?.name ?? null };
}

export async function updateItemAction(id: string, form: FormData): Promise<ItemSaveResult> {
  if (!isItemId(id)) return { ok: false, problems: ["That item doesn't exist."] };
  const parsed = parseItemInput(itemFields(form, text(form, "project")), await todayFor(form));
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  const saved = await updateItem(id, parsed.value);
  if (!saved.ok) return { ok: false, problems: [saved.message] };
  refresh();
  return { ok: true, title: saved.value.title, where: saved.value.project?.name ?? null };
}

// The checkbox on every item row.
export async function setDoneAction(id: string, done: boolean): Promise<DoneResult> {
  if (!isItemId(id) || typeof done !== "boolean") return { ok: false, message: "That item doesn't exist." };
  const saved = await setItemDone(id, done);
  if (!saved.ok) return { ok: false, message: saved.message };
  refresh();
  return { ok: true };
}

// The "Mark done" and "Reopen" buttons on an item's own page.
export async function setDoneFromPageAction(id: string, done: boolean): Promise<void> {
  if (!isItemId(id)) redirect("/");
  const saved = await setItemDone(id, done === true);
  redirect(saved.ok ? `/items/${id}` : `/items/${id}?error=done`);
}

export async function deleteItemAction(id: string): Promise<void> {
  if (!isItemId(id)) redirect("/");
  const found = await getItem(id);
  const back = found.ok && found.value?.project_id ? `/projects/${found.value.project_id}` : "/inbox";
  const deleted = await deleteItem(id);
  redirect(deleted.ok ? back : `/items/${id}?error=delete`);
}

const WAIT_ERRORS: Record<string, string> = {
  "That would make these items wait on each other.": "wait-cycle",
  "An item can't wait on itself.": "wait-self",
};

export async function addWaitAction(id: string, form: FormData): Promise<void> {
  if (!isItemId(id)) redirect("/");
  const waitsOn = text(form, "waitsOn");
  if (!isItemId(waitsOn)) redirect(`/items/${id}?error=wait-pick`);
  const saved = await addWait(id, waitsOn);
  redirect(saved.ok ? `/items/${id}` : `/items/${id}?error=${WAIT_ERRORS[saved.message] ?? "wait"}`);
}

export async function removeWaitAction(id: string, waitsOn: string): Promise<void> {
  if (!isItemId(id) || !isItemId(waitsOn)) redirect("/");
  const saved = await removeWait(id, waitsOn);
  redirect(saved.ok ? `/items/${id}` : `/items/${id}?error=wait-remove`);
}
