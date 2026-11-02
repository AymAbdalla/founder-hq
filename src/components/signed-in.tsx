import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppFrame } from "./app-frame";

// Sends a signed-out visitor to sign-in. Callers run `await connection()` first, so the
// page renders per request and gets its own content-policy nonce (security rule S1).
export async function requireSignedIn(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
}

// A view that is not built yet: its title, in the frame, and the plan step that brings it.
export function PlaceholderView({ current, title, children }: { current: string; title: string; children: React.ReactNode }) {
  return (
    <AppFrame current={current}>
      <div className="page-head">
        <h1>{title}</h1>
      </div>
      <p className="lede">{children}</p>
    </AppFrame>
  );
}
