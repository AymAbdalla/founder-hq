import "server-only";
import { logEvent } from "@/lib/log";
import { allowSignInEvent, type SignInEvent } from "@/lib/supabase/admin";

// Security rule S5: per-address limits kept in HQ's database, reachable only by HQ's server.
// One sign-in email per address per minute and five per hour; five code tries per 15 minutes.
// Supabase's own per-IP limits stay on as a backstop.
const MESSAGES: Record<string, string> = {
  wait_minute: "You can ask for a new code once a minute. Wait a moment and try again.",
  wait_hour: "Too many sign-in emails for this address. Try again in an hour.",
  wait_attempts: "Too many tries. Wait 15 minutes, then ask for a new code.",
};
const UNAVAILABLE = "Sign-in is unavailable right now. Try again shortly.";

// Returns null when allowed, or the message to show. Fails closed if the check cannot run.
export async function checkSignInLimit(kind: SignInEvent, email: string): Promise<string | null> {
  const { answer, failed } = await allowSignInEvent(kind, email);
  if (failed) {
    logEvent("sign_in_limit_check_failed", { kind });
    return UNAVAILABLE;
  }
  if (answer === "ok") return null;
  return MESSAGES[answer ?? ""] ?? UNAVAILABLE;
}
