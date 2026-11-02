import Link from "next/link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ProjectNotFound, loadProject } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { deleteProjectAction } from "../../actions";

export const metadata = { title: "Delete project · Founder HQ" };

// Spec P8: deleting asks first. The choice of moving items to the Inbox or deleting them
// arrives with items (slice 6).
export default async function DeleteProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireSignedIn();
  const { id } = await params;
  const { project, failed } = await loadProject(id);
  if (!project) return <ProjectNotFound failed={failed} />;
  return (
    <AppFrame current="/projects" project={project.id}>
      <div className="page-head">
        <h1>Delete {project.name}?</h1>
      </div>
      <p className="lede">This removes the project and its notes. It can&apos;t be undone.</p>
      <div className="actions">
        <form action={deleteProjectAction.bind(null, project.id)}>
          <button type="submit" className="btn btn-danger">Delete project</button>
        </form>
        <Link href={`/projects/${project.id}`} className="btn">Cancel</Link>
      </div>
    </AppFrame>
  );
}
