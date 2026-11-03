import { connection } from "next/server";
import { AddItem } from "@/components/add-item";
import { AppFrame } from "@/components/app-frame";
import { ItemGroup, pickerProjects } from "@/components/items";
import { requireSignedIn } from "@/components/signed-in";
import { listItems } from "@/lib/items/data";
import { currentToday } from "@/lib/time-zone";

export const metadata = { title: "Inbox · Founder HQ" };

// Spec P15: open items with no project. Moving one into a project works from its own page
// now; plan slice 8 adds a quick "assign to a project" control on each row.
export default async function InboxPage() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  const [items, projects, today] = await Promise.all([listItems({ inbox: true, open: true }), pickerProjects(), currentToday()]);
  return (
    <AppFrame current="/inbox">
      <div className="page-head">
        <h1>Inbox</h1>
        <span className="when">Things with no project yet</span>
      </div>
      <AddItem projects={projects} />
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
      />
    </AppFrame>
  );
}
