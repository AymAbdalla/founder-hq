// The notification job: called every minute, it sends every due test notification to each
// device the account turned notifications on for. Kept free of database and network code,
// so its rules can be tested with stand-ins.
export type DueNotification = { id: string; account_id: string };
export type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
export type SendOutcome = "sent" | "gone" | "failed";

export type JobDeps = {
  claim: (limit: number) => Promise<DueNotification[]>;
  subscriptionsFor: (accountId: string) => Promise<Subscription[]>;
  send: (subscription: Subscription, payload: string) => Promise<SendOutcome>;
  removeSubscription: (accountId: string, subscriptionId: string) => Promise<void>;
  markSent: (accountId: string, notificationId: string, devices: number) => Promise<void>;
};

export const BATCH = 50;
export const TEST_PAYLOAD = JSON.stringify({ title: "Founder HQ", body: "Test notification: notifications work on this device.", url: "/notifications" });

export async function runNotificationJob(deps: JobDeps): Promise<{ notifications: number; sent: number; failed: number; removed: number }> {
  const due = await deps.claim(BATCH);
  const totals = { notifications: due.length, sent: 0, failed: 0, removed: 0 };
  for (const note of due) {
    const subscriptions = await deps.subscriptionsFor(note.account_id);
    let delivered = 0;
    let failed = 0;
    for (const sub of subscriptions) {
      const outcome = await deps.send(sub, TEST_PAYLOAD);
      if (outcome === "sent") delivered += 1;
      else if (outcome === "gone") {
        // The browser or phone dropped this sign-up; it can never be used again.
        await deps.removeSubscription(note.account_id, sub.id);
        totals.removed += 1;
      } else failed += 1;
    }
    totals.sent += delivered;
    totals.failed += failed;
    // Retry later (the claim expires) only when every try failed for a temporary reason.
    if (failed > 0 && delivered === 0) continue;
    await deps.markSent(note.account_id, note.id, delivered);
  }
  return totals;
}
