import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { Icon } from "@/components/icons";
import { ItemGroup } from "@/components/items";
import { requireSignedIn } from "@/components/signed-in";
import { listItems } from "@/lib/items/data";
import { filterEverything, parseEverythingFilter } from "@/lib/items/everything";
import { ITEM_KINDS, KIND_LABEL } from "@/lib/items/input";
import { listProjects } from "@/lib/projects/data";
import { currentToday } from "@/lib/time-zone";

export const metadata = { title: "Everything · Founder HQ" };

// Spec P18: every item, with search over titles and notes and filters by kind, status and
// project. Items in archived projects stay out unless the "Archived projects" filter is chosen
// (spec P7, check 13). The filters live in the address, so a filtered view can be bookmarked.
export default async function EverythingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  const filter = parseEverythingFilter(await searchParams);
  const [items, projects, today] = await Promise.all([listItems(), listProjects(), currentToday()]);
  const all = items.ok ? items.value : [];
  const shown = filterEverything(all, filter);
  const current = (projects.ok ? projects.value : []).filter((p) => p.status !== "archived");

  return (
    <AppFrame current="/everything">
      <div className="page-head">
        <h1>Everything</h1>
        <span className="when">Every item in every project and the Inbox</span>
      </div>
      <form className="filters" method="get" action="/everything" role="search" aria-label="Filter items">
        <span className="search">
          <Icon name="all" />
          <input type="search" name="q" defaultValue={filter.q} placeholder="Search titles and notes" aria-label="Search items" maxLength={100} />
        </span>
        <select name="kind" aria-label="Kind" className="chip-select" defaultValue={filter.kind}>
          <option value="all">All kinds</option>
          {ITEM_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select name="status" aria-label="Status" className="chip-select" defaultValue={filter.status}>
          <option value="all">Open and done</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
        </select>
        <select name="project" aria-label="Project" className="chip-select" defaultValue={filter.project}>
          <option value="all">All projects</option>
          <option value="inbox">Inbox</option>
          {current.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="archived">Archived projects</option>
        </select>
        <button type="submit" className="btn btn-small">
          Show
        </button>
      </form>
      {!items.ok && (
        <p role="alert" className="alert">
          Couldn&apos;t load your items. Try again in a moment.
        </p>
      )}
      <ItemGroup
        title="Items"
        items={shown}
        today={today}
        empty={all.length === 0 ? "Nothing here yet. Add items from Today, the Inbox or a project." : "No items match these filters."}
      />
    </AppFrame>
  );
}
