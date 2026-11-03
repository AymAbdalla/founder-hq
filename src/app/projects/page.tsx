import Link from "next/link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { WeekStrip } from "@/components/done-grid";
import { Icon } from "@/components/icons";
import { STATUS_LABEL, StatusMark, shortDate } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { projectSummary, type ProjectSummary } from "@/lib/activity";
import { todayIn } from "@/lib/dates";
import { listItems, type Item } from "@/lib/items/data";
import { listProjects } from "@/lib/projects/data";
import { currentTimeZone } from "@/lib/time-zone";
import { PROJECT_STATUSES, isProjectStatus, type ProjectStatus } from "@/lib/projects/input";

export const metadata = { title: "Projects · Founder HQ" };

// Spec P16: one row per project, tabs for active, paused and archived, and a search box.
// Each row: status, next step, open items, the last item ticked done and the last 7 days.
// Plan progress and the last commit appear only for projects with a linked repo (slices 11, 12).
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await connection();
  await requireSignedIn();
  const params = await searchParams;
  const status: ProjectStatus = isProjectStatus(params.status) ? params.status : "active";
  const query = (params.q ?? "").trim().slice(0, 100);

  const zone = await currentTimeZone();
  const today = todayIn(zone);
  const [all, items] = await Promise.all([listProjects(), listItems()]);
  const projects = all.ok ? all.value : [];
  const byProject = new Map<string, Item[]>();
  for (const item of items.ok ? items.value : []) {
    if (item.project_id) byProject.set(item.project_id, [...(byProject.get(item.project_id) ?? []), item]);
  }
  const summaries = new Map<string, ProjectSummary>(projects.map((p) => [p.id, projectSummary(byProject.get(p.id) ?? [], today, zone)]));
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
                  <th scope="col" className="c-next">Next step</th>
                  <th scope="col" className="num">Open</th>
                  <th scope="col" className="c-latest">Latest done</th>
                  <th scope="col" className="c-week">Last 7 days</th>
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
                          {(p.kind || p.summary) && <span className="sum">{[p.kind, p.summary].filter(Boolean).join(" · ")}</span>}
                        </span>
                      </span>
                    </td>
                    <SummaryCells summary={summaries.get(p.id)!} />
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

function SummaryCells({ summary }: { summary: ProjectSummary }) {
  return (
    <>
      <td className="c-next">{summary.next ? <Link href={`/items/${summary.next.id}`}>{summary.next.title}</Link> : <span className="muted">No next step</span>}</td>
      <td className="num">{summary.open}</td>
      <td className="c-latest">
        {summary.latest && (
          <>
            <span className="latest-title">{summary.latest.title}</span> <span className="muted">{shortDate(summary.latest.done_at)}</span>
          </>
        )}
      </td>
      <td className="c-week">
        <WeekStrip week={summary.week} />
      </td>
    </>
  );
}
