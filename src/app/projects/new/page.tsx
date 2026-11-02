import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ProjectForm } from "@/components/project-form";
import { requireSignedIn } from "@/components/signed-in";
import { createProjectAction } from "../actions";

export const metadata = { title: "New project · Founder HQ" };

export default async function NewProjectPage() {
  await connection();
  await requireSignedIn();
  return (
    <AppFrame current="/projects">
      <div className="page-head">
        <h1>New project</h1>
      </div>
      <ProjectForm
        save={createProjectAction}
        initial={{ name: "", kind: "", summary: "", notes: "" }}
        submitLabel="Create project"
        cancelHref="/projects"
      />
    </AppFrame>
  );
}
