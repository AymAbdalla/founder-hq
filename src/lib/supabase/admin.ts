import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Security rule S2: the only place the master database key is read.
// - `server-only` makes the build fail if browser code imports this file.
// - Lint bans reading the key, or creating Supabase clients, anywhere else.
// - The master client never leaves this file except through adminForAccount,
//   which requires the account it works for.
//
// Open for slice 4: AI tool and helper routes must run *as* the account so row-level
// security still applies. Until that is designed, nothing calls adminForAccount.
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AccountAdmin = {
  readonly accountId: string;
  readonly db: SupabaseClient;
};

function masterClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function adminForAccount(accountId: string): AccountAdmin {
  if (!ACCOUNT_ID.test(accountId)) {
    throw new Error("adminForAccount needs a real account id.");
  }
  return { accountId, db: masterClient() };
}

// Security rule S5: records a sign-in event against an address's limits, or says why not.
// Only HQ's server may call the database function. It runs before anyone is signed in,
// so there is no account yet, and it touches no account data. Returns the database's
// answer: "ok", or a reason such as "wait_minute".
export type SignInEvent = "email_sent" | "code_attempt";

export async function allowSignInEvent(kind: SignInEvent, email: string): Promise<{ answer: string | null; failed: boolean }> {
  const { data, error } = await masterClient().rpc("allow_sign_in_event", { p_kind: kind, p_email: email });
  if (error) return { answer: null, failed: true };
  return { answer: typeof data === "string" ? data : null, failed: false };
}
