import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ProjectForm } from "@/components/project-form";
import { ProjectNotFound, loadProject } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { updateProjectAction } from "../../actions";

export const metadata = { title: "Edit project · Founder HQ" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireSignedIn();
  const { id } = await params;
  const { project, failed } = await loadProject(id);
  if (!project) return <ProjectNotFound failed={failed} />;
  return (
    <AppFrame current="/projects" project={project.id}>
      <div className="page-head">
        <h1>Edit {project.name}</h1>
      </div>
      <ProjectForm
        save={updateProjectAction.bind(null, project.id)}
        initial={{ name: project.name, kind: project.kind ?? "", summary: project.summary ?? "", notes: project.notes ?? "" }}
        submitLabel="Save changes"
        cancelHref={`/projects/${project.id}`}
      />
    </AppFrame>
  );
}
