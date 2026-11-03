import "server-only";
import webpush from "web-push";
import { logEvent } from "@/lib/log";
import { adminForAccount, claimDueTestNotifications } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint } from "./endpoint";
import { runNotificationJob, type JobDeps, type SendOutcome, type Subscription } from "./job";

// Real stand-ins for the job: the database (always for one named account) and web push.
// The notification keys come from VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("Notification keys are not set.");
  return { publicKey, privateKey, subject };
}

async function send(sub: Subscription, payload: string): Promise<SendOutcome> {
  // Checked again at send time, so a stored address can never point anywhere else.
  if (!isAllowedPushEndpoint(sub.endpoint)) return "gone";
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
      vapidDetails: vapid(),
      TTL: 300,
      urgency: "high",
      timeout: 10_000,
    });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    logEvent("push_send_failed", { status: status ?? null });
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

const deps: JobDeps = {
  claim: claimDueTestNotifications,
  subscriptionsFor: async (accountId) => {
    const { db } = adminForAccount(accountId);
    const { data, error } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("account_id", accountId);
    if (error) throw new Error(`subscriptions failed: ${error.code ?? "unknown"}`);
    return data as Subscription[];
  },
  send,
  removeSubscription: async (accountId, id) => {
    const { db } = adminForAccount(accountId);
    await db.from("push_subscriptions").delete().eq("account_id", accountId).eq("id", id);
  },
  markSent: async (accountId, id, devices) => {
    const { db } = adminForAccount(accountId);
    await db.from("test_notifications").update({ sent_at: new Date().toISOString(), sent_count: devices }).eq("account_id", accountId).eq("id", id);
    if (devices > 0) await db.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("account_id", accountId);
  },
};

export function sendDueNotifications() {
  return runNotificationJob(deps);
}
