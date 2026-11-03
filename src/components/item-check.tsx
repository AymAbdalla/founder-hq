"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setDoneAction } from "@/app/items/actions";
import { Icon } from "./icons";

// The done checkbox on an item row. It turns green at once, saves, and the page redraws from
// the server. If the save fails it turns back and says so (spec P48).
export function ItemCheck({ id, title, done }: { id: string; title: string; done: boolean }) {
  const [checked, setChecked] = useOptimistic(done);
  const [problem, setProblem] = useState("");
  const [, startTransition] = useTransition();

  function change(next: boolean) {
    setProblem("");
    startTransition(async () => {
      setChecked(next);
      try {
        const result = await setDoneAction(id, next);
        if (!result.ok) setProblem(`Not saved: ${result.message}`);
      } catch {
        setProblem("Not saved: HQ couldn't be reached. Try again when you're back online.");
      }
    });
  }

  return (
    <>
      <label className="check">
        <input type="checkbox" aria-label={`Done: ${title}`} checked={checked} onChange={(e) => change(e.target.checked)} />
        <span>
          <Icon name="tick" />
        </span>
      </label>
      {problem && (
        <span role="alert" className="row-alert">
          {problem}
        </span>
      )}
    </>
  );
}
