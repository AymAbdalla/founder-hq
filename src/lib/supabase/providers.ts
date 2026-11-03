import "server-only";
import { supabasePublicKey, supabaseUrl } from "./config";

// Whether Supabase has GitHub sign-in switched on here. It is off on a copy of HQ until that
// copy has its own GitHub sign-in app, and then HQ hides the button instead of sending people
// to Supabase's raw error. Checked at most once a minute. Unknown counts as on, so a brief
// failure never hides a working sign-in; the start route then reports any problem in words.
export function githubEnabledFrom(settings: unknown): boolean {
  if (typeof settings !== "object" || settings === null) return true;
  const external = (settings as { external?: unknown }).external;
  if (typeof external !== "object" || external === null) return true;
  return (external as { github?: unknown }).github === true;
}

export async function githubSignInEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/auth/v1/settings`, {
      headers: { apikey: supabasePublicKey() },
      next: { revalidate: 60 },
    });
    if (!response.ok) return true;
    return githubEnabledFrom(await response.json());
  } catch {
    return true;
  }
}
