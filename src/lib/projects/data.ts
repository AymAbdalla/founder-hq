import "server-only";
import { logEvent } from "@/lib/log";
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
  let query = db.from("projects").select(COLUMNS).order("created_at", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
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

// Slice 6 adds items; then deleting a project will also move its items to the Inbox (spec P8).
export async function deleteProject(id: string): Promise<ProjectResult<null>> {
  const db = await createSupabaseServerClient();
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) return failure("delete", error);
  return { ok: true, value: null };
}
