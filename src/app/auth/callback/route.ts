import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GitHub sign-in returns here through Supabase with a one-time code. The code only works
// together with the proof cookie set by /auth/github in this same browser.
// Always lands on HQ's own pages: no "next" address is read from the link.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!code || params.has("error")) {
    // Supabase refuses a GitHub email that GitHub has not verified (spec P2). Only this fixed
    // code is recognised; no text from the address is passed on.
    const unverified = params.get("error_code") === "provider_email_needs_verification";
    logEvent("github_sign_in_failed", { reason: unverified ? "email_unverified" : params.has("error") ? "provider_error" : "no_code" });
    redirect(unverified ? "/sign-in?error=github-email" : "/sign-in?error=github");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logEvent("github_sign_in_failed", { reason: "exchange", status: error.status ?? null, code: error.code ?? null });
    redirect("/sign-in?error=github");
  }
  redirect("/");
}
