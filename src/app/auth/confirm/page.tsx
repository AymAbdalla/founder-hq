import { connection } from "next/server";
import { ConfirmForm } from "./confirm-form";

export const metadata = { title: "Finish signing in · Founder HQ" };

// Opening the link only shows a button. The sign-in happens when the person presses it,
// so email scanners that open links in advance cannot use the link up.
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  await connection();
  const { token_hash: tokenHash = "" } = await searchParams;
  return (
    <main>
      <h1>Finish signing in</h1>
      <ConfirmForm tokenHash={tokenHash} />
    </main>
  );
}
