"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmLink, type ConfirmState } from "./actions";

export function ConfirmForm({ tokenHash }: { tokenHash: string }) {
  const [state, confirm, pending] = useActionState(confirmLink, { message: "" } satisfies ConfirmState);
  return (
    <form action={confirm}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <button type="submit" disabled={pending}>Finish signing in</button>
      {state.message && (
        <p role="alert">
          {state.message} <Link href="/sign-in">Get a new code</Link>
        </p>
      )}
    </form>
  );
}
