import { AppLink } from "@/components/app-link";
import { connection } from "next/server";
import { AddItem } from "@/components/add-item";
import { AppFrame } from "@/components/app-frame";
import { DoneGrid } from "@/components/done-grid";
import { ItemGroup, pickerProjects } from "@/components/items";
import { STATUS_LABEL, StatusMark, ProjectNotFound, loadProject, shortDate } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { listDone, listItems } from "@/lib/items/data";
import { currentTimeZone, hoursAgo } from "@/lib/time-zone";
import { todayIn } from "@/lib/dates";
import { setStatusAction } from "../actions";

const ERRORS: Record<string, string> = {
  status: "Couldn't change the status. Try again.",
  delete: "Couldn't delete the project. Try again.",
};

// Spec P9: the project's own page: open to-dos and reminders, features, ideas, recently
// finished items and notes. Repo facts and plans only appear once a repo is linked
// (slice 11), never as empty fields.
const RECENT_DAYS = 14;
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  await requireSignedIn();
  const { id } = await params;
  const { error } = await searchParams;
  const { project, failed } = await loadProject(id);
  if (!project) return <ProjectNotFound failed={failed} />;

  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : null;
  const since = hoursAgo(RECENT_DAYS * 24);
  const zone = await currentTimeZone();
  const today = todayIn(zone);
  const [open, recent, projects, done] = await Promise.all([
    listItems({ project: project.id, open: true }),
    listItems({ project: project.id, doneSince: since }),
    pickerProjects(),
    listDone(hoursAgo(54 * 7 * 24)),
  ]);
  const doneHere = done.ok ? done.value.filter((d) => d.project_id === project.id).map((d) => d.done_at) : [];
  const openItems = open.ok ? open.value : [];
  const of = (...kinds: string[]) => openItems.filter((i) => kinds.includes(i.kind));
  const finished = (recent.ok ? recent.value : []).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")).slice(0, 20);
  const statusButton = (status: string, label: string) => (
    <form action={setStatusAction.bind(null, project.id, status)}>
      <button type="submit" className="btn btn-small">{label}</button>
    </form>
  );

  return (
    <AppFrame current="/projects" project={project.id}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <AppLink href="/projects">Projects</AppLink> / <span>{project.name}</span>
      </nav>
      <div className="page-head project-head">
        <StatusMark status={project.status} />
        <h1>{project.name}</h1>
      </div>
      {message && <p role="alert" className="alert">{message}</p>}
      <p className="facts">
        <span>{STATUS_LABEL[project.status]}</span>
        {project.kind && <span>{project.kind}</span>}
        <span>Updated {shortDate(project.updated_at)}</span>
      </p>
      {project.summary && <p className="lede">{project.summary}</p>}

      <div className="actions">
        <AppLink href={`/projects/${project.id}/edit`} className="btn btn-small">Edit</AppLink>
        {project.status === "active" && statusButton("paused", "Pause")}
        {project.status === "paused" && statusButton("active", "Resume")}
        {project.status !== "archived" && statusButton("archived", "Archive")}
        {project.status === "archived" && statusButton("active", "Reopen")}
        <AppLink href={`/projects/${project.id}/delete`} className="btn btn-small btn-quiet-danger">Delete</AppLink>
      </div>

      <DoneGrid doneAts={doneHere} timeZone={zone} today={today} weeks={53} span="the last year" />
      {project.status !== "archived" ? (
        <AddItem projects={projects} defaultProject={project.id} />
      ) : (
        <p className="muted">This project is archived. Reopen it to add items.</p>
      )}
      {!open.ok && (
        <p role="alert" className="alert">
          Couldn&apos;t load this project&apos;s items. Try again in a moment.
        </p>
      )}
      <ItemGroup title="To-dos and reminders" items={of("todo", "reminder")} today={today} hideProject empty="No open to-dos. Add the next step above." />
      <ItemGroup title="Features" items={of("feature")} today={today} hideProject />
      <ItemGroup title="Ideas" items={of("idea")} today={today} hideProject />
      <ItemGroup title="Recently done" items={finished} today={today} hideProject />

      <h2>Notes</h2>
      {project.notes ? <p className="notes">{project.notes}</p> : <p className="empty-row">No notes. Use Edit to add some.</p>}
    </AppFrame>
  );
}
