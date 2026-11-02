"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // "local" ends this device's session on the server. Signing out everywhere comes in slice 17.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/sign-in");
}
