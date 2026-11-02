import Link from "next/link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { STATUS_LABEL, StatusMark, ProjectNotFound, loadProject, shortDate } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { setStatusAction } from "../actions";

const ERRORS: Record<string, string> = {
  status: "Couldn't change the status. Try again.",
  delete: "Couldn't delete the project. Try again.",
};

// Spec P9: the project's own page. To-dos, ideas and features arrive with items (slice 6);
// repo facts and plans only appear once a repo is linked (slice 11), never as empty fields.
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
  const statusButton = (status: string, label: string) => (
    <form action={setStatusAction.bind(null, project.id, status)}>
      <button type="submit" className="btn btn-small">{label}</button>
    </form>
  );

  return (
    <AppFrame current="/projects" project={project.id}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link> / <span>{project.name}</span>
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
        <Link href={`/projects/${project.id}/edit`} className="btn btn-small">Edit</Link>
        {project.status === "active" && statusButton("paused", "Pause")}
        {project.status === "paused" && statusButton("active", "Resume")}
        {project.status !== "archived" && statusButton("archived", "Archive")}
        {project.status === "archived" && statusButton("active", "Reopen")}
        <Link href={`/projects/${project.id}/delete`} className="btn btn-small btn-quiet-danger">Delete</Link>
      </div>

      <h2>Notes</h2>
      {project.notes ? <p className="notes">{project.notes}</p> : <p className="empty-row">No notes. Use Edit to add some.</p>}
    </AppFrame>
  );
}
