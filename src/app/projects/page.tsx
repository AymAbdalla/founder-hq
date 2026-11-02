import Link from "next/link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { Icon } from "@/components/icons";
import { STATUS_LABEL, StatusMark, shortDate } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { listProjects } from "@/lib/projects/data";
import { PROJECT_STATUSES, isProjectStatus, type ProjectStatus } from "@/lib/projects/input";

export const metadata = { title: "Projects · Founder HQ" };

// Spec P16: one row per project, tabs for active, paused and archived, and a search box.
// Next step, open items, plan progress, latest activity and the 7-day strip arrive with
// items (slice 6) and GitHub (slice 11); until then a row shows only what exists.
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await connection();
  await requireSignedIn();
  const params = await searchParams;
  const status: ProjectStatus = isProjectStatus(params.status) ? params.status : "active";
  const query = (params.q ?? "").trim().slice(0, 100);

  const all = await listProjects();
  const projects = all.ok ? all.value : [];
  const count = (s: ProjectStatus) => projects.filter((p) => p.status === s).length;
  const needle = query.toLowerCase();
  const shown = projects.filter(
    (p) => p.status === status && (!needle || [p.name, p.summary, p.kind].some((t) => t?.toLowerCase().includes(needle))),
  );

  return (
    <AppFrame current="/projects">
      <div className="page-head">
        <h1>Projects</h1>
        <Link href="/projects/new" className="btn btn-primary btn-small head-action">
          <Icon name="plus" />
          New project
        </Link>
      </div>

      {!all.ok ? (
        <p role="alert" className="alert">Couldn&apos;t load your projects. Try again in a moment.</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet.</p>
          <p className="muted">A project is anything with steps: an app, a side project or a business. Add one, then jot its to-dos into it.</p>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <nav className="tabs" aria-label="Status">
              {PROJECT_STATUSES.map((s) => (
                <Link key={s} href={s === "active" ? "/projects" : `/projects?status=${s}`} aria-current={s === status ? "page" : undefined}>
                  {STATUS_LABEL[s]} <span className="n">{count(s)}</span>
                </Link>
              ))}
            </nav>
            <form className="search" method="get" action="/projects" role="search">
              <Icon name="all" />
              {status !== "active" && <input type="hidden" name="status" value={status} />}
              <input type="search" name="q" defaultValue={query} placeholder="Find a project" aria-label="Find a project" maxLength={100} />
            </form>
          </div>

          {shown.length === 0 ? (
            <p className="empty-row">
              {query ? `No ${status} project matches “${query}”.` : `No ${status} projects.`}
            </p>
          ) : (
            <table className="ptable" aria-label="Projects">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="c-date">Updated</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="pname">
                        <StatusMark status={p.status} />
                        <span>
                          <Link href={`/projects/${p.id}`}>{p.name}</Link>
                          {p.summary && <span className="sum">{p.summary}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="muted">{p.kind}</td>
                    <td className="muted c-date">{shortDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </AppFrame>
  );
}
