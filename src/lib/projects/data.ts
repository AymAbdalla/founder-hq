import "server-only";
import { logEvent } from "@/lib/log";
import { allRows } from "@/lib/supabase/all-rows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectFields, ProjectInput, ProjectStatus } from "./input";

// Thin database calls for projects. They run as the signed-in user, so row-level security
// decides what is visible. Errors become plain messages; database text is never passed on.
export type Project = {
  id: string;
  name: string;
  kind: string | null;
  summary: string | null;
  notes: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type ProjectResult<T> = { ok: true; value: T } | { ok: false; message: string };

const COLUMNS = "id, name, kind, summary, notes, status, created_at, updated_at";
const DUPLICATE_NAME = "You already have a project with that name.";
const GENERIC_FAILURE = "Couldn't save the project. Try again.";

function failure(action: string, error: { code?: string }): { ok: false; message: string } {
  logEvent("projects_failed", { action, code: error.code ?? "unknown" });
  return { ok: false, message: error.code === "23505" ? DUPLICATE_NAME : GENERIC_FAILURE };
}

export async function listProjects(status?: ProjectStatus): Promise<ProjectResult<Project[]>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await allRows((from, to) => {
    let query = db.from("projects").select(COLUMNS);
    if (status) query = query.eq("status", status);
    return query.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  });
  if (error) return failure("list", error);
  return { ok: true, value: data as Project[] };
}

export async function getProject(id: string): Promise<ProjectResult<Project | null>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("projects").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return failure("get", error);
  return { ok: true, value: (data as Project | null) ?? null };
}

export async function createProject(input: ProjectInput): Promise<ProjectResult<Project>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("projects").insert(input).select(COLUMNS).single();
  if (error) return failure("create", error);
  return { ok: true, value: data as Project };
}

export async function updateProject(id: string, input: ProjectFields): Promise<ProjectResult<Project>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("projects").update(input).eq("id", id).select(COLUMNS).single();
  if (error) return failure("update", error);
  return { ok: true, value: data as Project };
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<ProjectResult<Project>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("projects").update({ status }).eq("id", id).select(COLUMNS).single();
  if (error) return failure("status", error);
  return { ok: true, value: data as Project };
}

// Deletes a project. With keepItems its items move to the Inbox; otherwise they are deleted too (spec P8).
export async function deleteProject(id: string, keepItems: boolean): Promise<ProjectResult<null>> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("delete_project", { target: id, keep_items: keepItems });
  if (error) return failure("delete", error);
  if (data !== true) return { ok: false, message: "That project doesn't exist." };
  return { ok: true, value: null };
}

export async function countProjectItems(id: string): Promise<ProjectResult<number>> {
  const db = await createSupabaseServerClient();
  const { count, error } = await db.from("items").select("id", { count: "exact", head: true }).eq("project_id", id);
  if (error) return failure("count_items", error);
  return { ok: true, value: count ?? 0 };
}
