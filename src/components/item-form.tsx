"use client";

import { useActionState } from "react";
import type { ItemSaveResult } from "@/app/(hq)/items/actions";
import { ITEM_KINDS, ITEM_NOTES_MAX, KIND_LABEL, TITLE_MAX } from "@/lib/items/input";
import type { PickerProject } from "./items";

type Values = { title: string; kind: string; project: string; date: string; time: string; notes: string };
type State = { problems: string[]; saved: boolean; values: Values; attempt: number };

const OFFLINE = "Not saved: HQ couldn't be reached. Your text is still here. Try again when you're back online.";

function read(form: FormData): Values {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  return { title: text("title"), kind: text("kind"), project: text("project"), date: text("date"), time: text("time"), notes: text("notes") };
}

// Edit every field of an item, including moving it to another project or the Inbox (spec P12).
// A failed save shows plain-words problems and keeps every field as typed (spec P48).
export function ItemForm({
  save,
  initial,
  projects,
  currentProject,
}: {
  save: (form: FormData) => Promise<ItemSaveResult>;
  initial: Values;
  projects: PickerProject[];
  currentProject: PickerProject | null;
}) {
  const [state, action, pending] = useActionState(
    async (prev: State, form: FormData): Promise<State> => {
      form.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
      const values = read(form);
      try {
        const result = await save(form);
        return result.ok
          ? { problems: [], saved: true, values, attempt: prev.attempt + 1 }
          : { problems: result.problems, saved: false, values, attempt: prev.attempt + 1 };
      } catch {
        return { problems: [OFFLINE], saved: false, values, attempt: prev.attempt + 1 };
      }
    },
    { problems: [], saved: false, values: initial, attempt: 0 },
  );

  // An item in an archived project keeps that project as a choice until it is moved out.
  const choices = currentProject && !projects.some((p) => p.id === currentProject.id) ? [...projects, currentProject] : projects;
  const v = state.values;

  // A new key after each try re-creates the fields with the typed values, because React
  // clears a form after its action runs.
  return (
    <form key={state.attempt} action={action} className="form" aria-label="Edit item" noValidate>
      {state.problems.length > 0 && (
        <div role="alert" className="form-alert">
          {state.problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
      <div className="field">
        <label htmlFor="item-title">Title</label>
        <input id="item-title" name="title" defaultValue={v.title} maxLength={TITLE_MAX} autoComplete="off" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="item-kind">Kind</label>
          <select id="item-kind" name="kind" defaultValue={v.kind}>
            {ITEM_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="item-project">Project</label>
          <select id="item-project" name="project" defaultValue={v.project}>
            <option value="">No project (Inbox)</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="item-date">Date</label>
          <input id="item-date" type="date" name="date" defaultValue={v.date} />
        </div>
        <div className="field">
          <label htmlFor="item-time">Time</label>
          <input id="item-time" type="time" name="time" defaultValue={v.time} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="item-notes">Notes</label>
        <textarea id="item-notes" name="notes" defaultValue={v.notes} maxLength={ITEM_NOTES_MAX} rows={4} />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Save changes
        </button>
        <p role="status" className="saved-msg muted">
          {state.saved ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}
