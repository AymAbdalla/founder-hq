import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import { githubSignInEnabled } from "@/lib/supabase/providers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Starts "Continue with GitHub". Supabase stores a one-time proof (PKCE) in a cookie and
// returns GitHub's sign-in address. The person comes back to /auth/callback.
export async function GET(request: NextRequest) {
  if (!(await githubSignInEnabled())) redirect("/sign-in?error=github-off");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${request.nextUrl.origin}/auth/callback`, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    logEvent("github_sign_in_start_failed", { status: error?.status ?? null, code: error?.code ?? null });
    redirect("/sign-in?error=github");
  }
  redirect(data.url);
}
