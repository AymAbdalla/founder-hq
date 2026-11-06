import { connection } from "next/server";
import { AddItem } from "@/components/add-item";
import { AppFrame } from "@/components/app-frame";
import { ItemGroup, pickerProjects, type PickerProject } from "@/components/items";
import { requireSignedIn } from "@/components/signed-in";
import { listItems, type Item } from "@/lib/items/data";
import { currentToday } from "@/lib/time-zone";
import { assignItemAction } from "../items/actions";

export const metadata = { title: "Inbox · Founder HQ" };

const ERRORS: Record<string, string> = {
  "assign-pick": "Choose a project to move it to.",
  assign: "Couldn't move the item. Try again.",
};

// Spec P15: open items with no project, each with a quick way to move it into one.
function Assign({ item, projects }: { item: Item; projects: PickerProject[] }) {
  if (projects.length === 0) return null;
  return (
    <form action={assignItemAction.bind(null, item.id)} className="assign">
      <select name="project" className="chip-select" aria-label={`Move “${item.title}” to`} defaultValue="">
        <option value="" disabled>
          Move to…
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-small" aria-label={`Move “${item.title}”`}>
        Move
      </button>
    </form>
  );
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  const { error } = await searchParams;
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : null;
  const [items, projects, today] = await Promise.all([listItems({ inbox: true, open: true }), pickerProjects(), currentToday()]);
  return (
    <AppFrame current="/inbox">
      <div className="page-head">
        <h1>Inbox</h1>
        <span className="when">Things with no project yet</span>
      </div>
      <AddItem projects={projects} />
      {message && (
        <p role="alert" className="alert">
          {message}
        </p>
      )}
      {!items.ok && (
        <p role="alert" className="alert">
          Couldn&apos;t load your items. Try again in a moment.
        </p>
      )}
      <ItemGroup
        title="To sort"
        items={items.ok ? items.value : []}
        today={today}
        empty="Inbox is empty. Anything you add without a project lands here."
        extra={(item) => <Assign item={item} projects={projects} />}
      />
    </AppFrame>
  );
}
