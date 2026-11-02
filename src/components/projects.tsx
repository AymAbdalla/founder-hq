import Link from "next/link";
import { getProject, type Project } from "@/lib/projects/data";
import { isProjectId, type ProjectStatus } from "@/lib/projects/input";
import { AppFrame } from "./app-frame";

export const STATUS_LABEL: Record<ProjectStatus, string> = { active: "Active", paused: "Paused", archived: "Archived" };

// The project's status as a small drawn mark: half-filled ring (active), pause bars, dashed ring.
export function StatusMark({ status }: { status: ProjectStatus }) {
  return (
    <svg className={`status status-${status}`} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {status === "archived" ? (
        <circle cx="7" cy="7" r="5.5" className="ring dashed" />
      ) : (
        <circle cx="7" cy="7" r="5.5" className="ring" />
      )}
      {status === "active" && <path d="M7 3.2A3.8 3.8 0 0 1 7 10.8z" className="fill" />}
      {status === "paused" && <path d="M5.6 5v4M8.4 5v4" className="bars" />}
    </svg>
  );
}

// Loads a project the signed-in account can see. Bad addresses and other accounts'
// projects both come back as null, so they look the same: not found.
export async function loadProject(id: string): Promise<{ project: Project | null; failed: boolean }> {
  if (!isProjectId(id)) return { project: null, failed: false };
  const result = await getProject(id);
  return result.ok ? { project: result.value, failed: false } : { project: null, failed: true };
}

export function ProjectNotFound({ failed }: { failed: boolean }) {
  return (
    <AppFrame current="/projects">
      <div className="page-head">
        <h1>{failed ? "Couldn't load the project" : "Project not found"}</h1>
      </div>
      <p className="lede">
        {failed ? "Try again in a moment." : "It may have been deleted, or the address is wrong."}{" "}
        <Link href="/projects">Back to projects</Link>
      </p>
    </AppFrame>
  );
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
