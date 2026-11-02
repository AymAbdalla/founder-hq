"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import type { SaveResult } from "@/app/projects/actions";
import { KIND_MAX, NAME_MAX, NOTES_MAX, SUMMARY_MAX } from "@/lib/projects/input";

type Values = { name: string; kind: string; summary: string; notes: string };
type State = { problems: string[]; values: Values; attempt: number };

const OFFLINE = "Not saved: HQ couldn't be reached. Your text is still here. Try again when you're back online.";

function read(form: FormData): Values {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  return { name: text("name"), kind: text("kind"), summary: text("summary"), notes: text("notes") };
}

// One form for creating and editing a project. On any failure it shows plain-words problems
// and keeps every field as typed, including when the network is down (spec P48).
export function ProjectForm({
  save,
  initial,
  submitLabel,
  cancelHref,
}: {
  save: (form: FormData) => Promise<SaveResult>;
  initial: Values;
  submitLabel: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: State, form: FormData): Promise<State> => {
      const values = read(form);
      try {
        const result = await save(form);
        if (result.ok) {
          router.push(`/projects/${result.id}`);
          return { problems: [], values, attempt: prev.attempt };
        }
        return { problems: result.problems, values, attempt: prev.attempt + 1 };
      } catch {
        return { problems: [OFFLINE], values, attempt: prev.attempt + 1 };
      }
    },
    { problems: [], values: initial, attempt: 0 },
  );

  // A new key after each failed try re-creates the fields with the typed values, because
  // React clears a form after its action runs.
  return (
    <form key={state.attempt} action={action} className="form" noValidate>
      {state.problems.length > 0 && (
        <div role="alert" className="form-alert">
          {state.problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={state.values.name} maxLength={NAME_MAX} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="kind">Kind</label>
        <input id="kind" name="kind" defaultValue={state.values.kind} maxLength={KIND_MAX} placeholder="App, Business, Side project…" autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="summary">Summary</label>
        <input id="summary" name="summary" defaultValue={state.values.summary} maxLength={SUMMARY_MAX} placeholder="One line about what it is" autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" defaultValue={state.values.notes} maxLength={NOTES_MAX} rows={5} />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {submitLabel}
        </button>
        <Link href={cancelHref} className="btn">
          Cancel
        </Link>
      </div>
    </form>
  );
}
