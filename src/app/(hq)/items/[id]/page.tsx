import { AppLink } from "@/components/app-link";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { ItemForm } from "@/components/item-form";
import { ItemNotFound, dueText, loadItem, pickerProjects } from "@/components/items";
import { requireSignedIn } from "@/components/signed-in";
import { listItems } from "@/lib/items/data";
import { KIND_LABEL } from "@/lib/items/input";
import { currentToday } from "@/lib/time-zone";
import { addWaitAction, removeWaitAction, setDoneFromPageAction, updateItemAction } from "../actions";

export const metadata = { title: "Item · Founder HQ" };

const ERRORS: Record<string, string> = {
  done: "Couldn't change the item. Try again.",
  delete: "Couldn't delete the item. Try again.",
  "wait-cycle": "That would make these items wait on each other.",
  "wait-self": "An item can't wait on itself.",
  "wait-pick": "Choose an item to wait on.",
  wait: "Couldn't add that. Try again.",
  "wait-remove": "Couldn't remove that. Try again.",
};

// Spec P10 to P12 and "Waiting on": one item, every field editable, the items it waits on,
// and the way to delete it.
export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await connection();
  await requireSignedIn();
  const { id } = await params;
  const { error } = await searchParams;
  const { item, failed } = await loadItem(id);
  if (!item) return <ItemNotFound failed={failed} />;

  const [projects, open, today] = await Promise.all([pickerProjects(), listItems({ open: true }), currentToday()]);
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : null;
  const done = item.done_at !== null;
  const due = dueText(item, today);
  const waitingOn = item.waitsOn.filter((w) => !w.done);
  const already = new Set(item.waitsOn.map((w) => w.id));
  const candidates = (open.ok ? open.value : []).filter((o) => o.id !== item.id && !already.has(o.id));
  const groups = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const key = c.project?.name ?? "Inbox";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <AppFrame current={item.project ? "/projects" : "/inbox"} project={item.project?.id}>
      <nav className="crumbs" aria-label="Breadcrumb">
        {item.project ? <AppLink href={`/projects/${item.project.id}`}>{item.project.name}</AppLink> : <AppLink href="/inbox">Inbox</AppLink>} / <span>{KIND_LABEL[item.kind]}</span>
      </nav>
      <div className="page-head item-head">
        <h1>{item.title}</h1>
      </div>
      {message && (
        <p role="alert" className="alert">
          {message}
        </p>
      )}
      <p className="facts">
        <span>{done ? "Done" : "Open"}</span>
        <span>{KIND_LABEL[item.kind]}</span>
        {due.text && <span className={due.tone}>{due.text}</span>}
        {!done && waitingOn.length > 0 && <span>Waiting on: {waitingOn.map((w) => w.title).join(", ")}</span>}
      </p>
      <div className="actions">
        <form action={setDoneFromPageAction.bind(null, item.id, !done)}>
          <button type="submit" className="btn btn-small">
            {done ? "Reopen" : "Mark done"}
          </button>
        </form>
        <AppLink href={`/items/${item.id}/delete`} className="btn btn-small btn-quiet-danger">
          Delete
        </AppLink>
      </div>

      <ItemForm
        save={updateItemAction.bind(null, item.id)}
        projects={projects}
        currentProject={item.project ? { id: item.project.id, name: item.project.name } : null}
        initial={{
          title: item.title,
          kind: item.kind,
          project: item.project_id ?? "",
          date: item.due_date ?? "",
          time: item.due_time ?? "",
          notes: item.notes ?? "",
        }}
      />

      <section className="waits" aria-labelledby="waits-head">
        <h2 id="waits-head">Waiting on</h2>
        {item.waitsOn.length === 0 ? (
          <p className="empty-row">Not waiting on anything.</p>
        ) : (
          <ul className="rows">
            {item.waitsOn.map((w) => (
              <li key={w.id} className={w.done ? "row done" : "row"}>
                <span className="row-main">
                  <AppLink className="title" href={`/items/${w.id}`}>
                    {w.title}
                  </AppLink>
                </span>
                <span className="due">{w.done ? "Done" : "Open"}</span>
                <form action={removeWaitAction.bind(null, item.id, w.id)}>
                  <button type="submit" className="link-btn" aria-label={`Stop waiting on ${w.title}`}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 ? (
          <form action={addWaitAction.bind(null, item.id)} className="wait-add">
            <label htmlFor="waits-on">Item to wait on</label>
            <select id="waits-on" name="waitsOn" className="chip-select" defaultValue="">
              <option value="" disabled>
                Choose an open item
              </option>
              {[...groups.entries()].map(([name, list]) => (
                <optgroup key={name} label={name}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="submit" className="btn btn-small">
              Add
            </button>
          </form>
        ) : (
          <p className="muted small">No other open items to wait on.</p>
        )}
        <p className="muted small">It shows in Today again once every item it waits on is done.</p>
      </section>
    </AppFrame>
  );
}
