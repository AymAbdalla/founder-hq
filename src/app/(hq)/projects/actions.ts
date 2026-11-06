"use server";

import { redirect } from "next/navigation";
import { createProject, deleteProject, setProjectStatus, updateProject } from "@/lib/projects/data";
import { isProjectId, isProjectStatus, parseProjectInput } from "@/lib/projects/input";

// Create and edit return a result instead of redirecting, so the form can keep what was
// typed when something goes wrong (spec P48). The form moves to the project page on success.
export type SaveResult = { ok: true; id: string } | { ok: false; problems: string[] };

function fields(form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return { name: text("name"), kind: text("kind"), summary: text("summary"), notes: text("notes") };
}

export async function createProjectAction(form: FormData): Promise<SaveResult> {
  const parsed = parseProjectInput(fields(form));
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  const saved = await createProject(parsed.value);
  return saved.ok ? { ok: true, id: saved.value.id } : { ok: false, problems: [saved.message] };
}

export async function updateProjectAction(id: string, form: FormData): Promise<SaveResult> {
  if (!isProjectId(id)) return { ok: false, problems: ["That project doesn't exist."] };
  const parsed = parseProjectInput(fields(form));
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  const { name, kind, summary, notes } = parsed.value;
  const saved = await updateProject(id, { name, kind, summary, notes });
  return saved.ok ? { ok: true, id } : { ok: false, problems: [saved.message] };
}

// Pause, resume, archive and reopen. Row-level security limits this to the account's own rows.
export async function setStatusAction(id: string, status: string): Promise<void> {
  if (!isProjectId(id) || !isProjectStatus(status)) redirect("/projects");
  const saved = await setProjectStatus(id, status);
  redirect(saved.ok ? `/projects/${id}` : `/projects/${id}?error=status`);
}

// Spec P8: the delete page asks whether the project's items move to the Inbox (the default)
// or are deleted too.
export async function deleteProjectAction(id: string, form: FormData): Promise<void> {
  if (!isProjectId(id)) redirect("/projects");
  const keepItems = form.get("items") !== "delete";
  const deleted = await deleteProject(id, keepItems);
  redirect(deleted.ok ? "/projects" : `/projects/${id}?error=delete`);
}
