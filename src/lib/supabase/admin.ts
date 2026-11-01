import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Security rule S2: the only place the master database key is read.
// - `server-only` makes the build fail if browser code imports this file.
// - Lint bans reading the key, or creating Supabase clients, anywhere else.
// - Every caller must name the account it is working for.
//
// Open for slice 4: AI tool and helper routes must run *as* the account so row-level
// security still applies. Until that is designed, nothing calls this module.
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AccountAdmin = {
  readonly accountId: string;
  readonly db: SupabaseClient;
};

export function adminForAccount(accountId: string): AccountAdmin {
  if (!ACCOUNT_ID.test(accountId)) {
    throw new Error("adminForAccount needs a real account id.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { accountId, db };
}
