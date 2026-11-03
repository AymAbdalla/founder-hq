"use server";

import { refresh } from "next/cache";
import { isAllowedPushEndpoint, isPushKey } from "@/lib/push/endpoint";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

export type NotifyResult = { ok: true } | { ok: false; message: string };

// Saves this device's notification sign-up for the signed-in account (security rule S6).
export async function savePushSubscriptionAction(input: { endpoint: unknown; p256dh: unknown; auth: unknown }): Promise<NotifyResult> {
  if (!isAllowedPushEndpoint(input.endpoint) || !isPushKey(input.p256dh, 200) || !isPushKey(input.auth, 100)) {
    return { ok: false, message: "This browser's notification sign-up wasn't recognised." };
  }
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("register_push_subscription", { p_endpoint: input.endpoint, p_p256dh: input.p256dh, p_auth: input.auth });
  if (error) {
    logEvent("push_register_failed", { code: error.code ?? "unknown" });
    return { ok: false, message: "Couldn't turn on notifications. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function scheduleTestAction(): Promise<NotifyResult> {
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("schedule_test_notification");
  if (error) {
    logEvent("push_test_failed", { code: error.code ?? "unknown" });
    return { ok: false, message: error.code === "P0001" ? "Three tests are already waiting. Wait for them first." : "Couldn't schedule the test. Try again." };
  }
  refresh();
  return { ok: true };
}
