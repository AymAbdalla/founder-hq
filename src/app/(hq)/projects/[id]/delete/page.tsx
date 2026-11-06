import { AppLink } from "@/components/app-link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ProjectNotFound, loadProject } from "@/components/projects";
import { requireSignedIn } from "@/components/signed-in";
import { countProjectItems } from "@/lib/projects/data";
import { deleteProjectAction } from "../../actions";

export const metadata = { title: "Delete project · Founder HQ" };

// Spec P8: deleting asks first, and asks what happens to the project's items: move them to
// the Inbox (the default) or delete them too.
export default async function DeleteProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireSignedIn();
  const { id } = await params;
  const { project, failed } = await loadProject(id);
  if (!project) return <ProjectNotFound failed={failed} />;
  const counted = await countProjectItems(project.id);
  const count = counted.ok ? counted.value : 0;
  const noun = count === 1 ? "item" : "items";
  return (
    <AppFrame current="/projects" project={project.id}>
      <div className="page-head">
        <h1>Delete {project.name}?</h1>
      </div>
      <p className="lede">This removes the project and its notes. It can&apos;t be undone.</p>
      <form action={deleteProjectAction.bind(null, project.id)} className="delete-form">
        {count > 0 && (
          <fieldset className="choice">
            <legend>
              What happens to its {count} {noun}?
            </legend>
            <label>
              <input type="radio" name="items" value="inbox" defaultChecked /> Move them to the Inbox
            </label>
            <label>
              <input type="radio" name="items" value="delete" /> Delete them too
            </label>
          </fieldset>
        )}
        <div className="actions">
          <button type="submit" className="btn btn-danger">Delete project</button>
          <AppLink href={`/projects/${project.id}`} className="btn">Cancel</AppLink>
        </div>
      </form>
    </AppFrame>
  );
}
