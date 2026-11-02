"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeCode, normalizeEmail } from "@/lib/auth/email";
import { checkSignInLimit } from "@/lib/auth/limits";
import { logEvent } from "@/lib/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  step: "email" | "code";
  email: string;
  message: string;
};

export async function requestCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = normalizeEmail(form.get("email"));
  if (!email) return { step: "email", email: "", message: "Enter a valid email address." };

  const origin = (await headers()).get("origin");
  if (!origin) return { step: "email", email, message: "Sign-in could not start. Reload the page and try again." };

  const limited = await checkSignInLimit("email_sent", email);
  if (limited) return { step: _prev.step === "code" ? "code" : "email", email, message: limited };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    logEvent("sign_in_email_failed", { status: error.status ?? null, code: error.code ?? null });
    return { step: "email", email, message: "We could not send the email. Wait a minute and try again." };
  }
  return { step: "code", email, message: "" };
}

export async function verifyCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = normalizeEmail(form.get("email"));
  if (!email) return { step: "email", email: "", message: "Start again with your email address." };
  const code = normalizeCode(form.get("code"));
  if (!code) return { step: "code", email, message: "Enter the 6 digits from the email." };

  const limited = await checkSignInLimit("code_attempt", email);
  if (limited) return { step: "code", email, message: limited };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return { step: "code", email, message: "That code is wrong or has expired. Check the email, or ask for a new code." };
  }
  redirect("/");
}
