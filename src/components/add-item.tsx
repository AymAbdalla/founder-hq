"use client";

import { useActionState, useRef, useState } from "react";
import { createItemAction } from "@/app/items/actions";
import { ITEM_KINDS, KIND_LABEL, TITLE_MAX, type ItemKind } from "@/lib/items/input";
import { NAME_MAX } from "@/lib/projects/input";
import { Icon } from "./icons";
import type { PickerProject } from "./items";

const OFFLINE = "Not saved: HQ couldn't be reached. Your text is still here. Try again when you're back online.";
const NEW_PROJECT = "new";

type State = { problems: string[]; added: string; attempt: number };

// Spec P11: one line to add an item. Type the title, optionally pick kind, project, date and
// time, and press Add. "New project…" creates a project on the spot. Every field is held in
// state, so nothing typed is lost when a save fails (spec P48). After an add, every choice
// goes back to its start, so the next item never lands in a project by accident, and the
// message says where the item went.
export function AddItem({ projects, defaultProject = "" }: { projects: PickerProject[]; defaultProject?: string }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("todo");
  const [project, setProject] = useState(defaultProject);
  const [newProject, setNewProject] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState(
    async (prev: State, form: FormData): Promise<State> => {
      form.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
      try {
        const result = await createItemAction(form);
        if (!result.ok) return { problems: result.problems, added: "", attempt: prev.attempt + 1 };
        setTitle("");
        setKind("todo");
        setProject(defaultProject);
        setNewProject("");
        setDate("");
        setTime("");
        titleRef.current?.focus();
        const where = result.where ? `to ${result.where}` : "to the Inbox";
        return { problems: [], added: `Added “${result.title}” ${where}.`, attempt: prev.attempt + 1 };
      } catch {
        return { problems: [OFFLINE], added: "", attempt: prev.attempt + 1 };
      }
    },
    { problems: [], added: "", attempt: 0 },
  );

  return (
    <form action={action} className="capture" aria-label="Add an item" noValidate>
      <div className="capture-line">
        <Icon name="plus" />
        <input
          ref={titleRef}
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="New item"
          placeholder="Add a to-do, reminder, idea or feature"
          maxLength={TITLE_MAX}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary btn-small" disabled={pending}>
          Add
        </button>
      </div>
      <div className="capture-opts">
        <select name="kind" aria-label="Kind" className="chip-select" value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
          {ITEM_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select name="project" aria-label="Project" className="chip-select" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">No project (Inbox)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NEW_PROJECT}>New project…</option>
        </select>
        {project === NEW_PROJECT && (
          <input
            name="newProject"
            className="chip-input"
            aria-label="New project name"
            placeholder="New project name"
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="off"
          />
        )}
        <input type="date" name="date" aria-label="Date" className="chip-input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" name="time" aria-label="Time" className="chip-input" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      {state.problems.length > 0 && (
        <div role="alert" className="form-alert capture-msg">
          {state.problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
      <p role="status" className="capture-msg muted">
        {state.problems.length === 0 ? state.added : ""}
      </p>
    </form>
  );
}
