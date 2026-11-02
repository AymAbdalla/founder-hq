import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { codeFrom, latestEmailTo, testEmail } from "./mail";

// A brand-new test account, signed in through the emailed code, acting as itself
// (public key plus its own session), so row-level security applies.
export type TestAccount = { email: string; id: string; db: SupabaseClient };

export function anonymousClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function newSignedInAccount(label: string): Promise<TestAccount> {
  const db = anonymousClient();
  const email = testEmail(label);
  const sent = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (sent.error) throw new Error(`Could not send code: ${sent.error.message}`);
  const token = codeFrom(await latestEmailTo(email));
  const { data, error } = await db.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) throw new Error(`Could not sign in: ${error?.message}`);
  return { email, id: data.user.id, db };
}
