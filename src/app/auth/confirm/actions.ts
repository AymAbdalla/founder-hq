"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConfirmState = { message: string };

export async function confirmLink(_prev: ConfirmState, form: FormData): Promise<ConfirmState> {
  const tokenHash = form.get("token_hash");
  const failed = { message: "This link has expired or was already used." };
  if (typeof tokenHash !== "string" || tokenHash.length === 0 || tokenHash.length > 200) return failed;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) return failed;
  redirect("/");
}
