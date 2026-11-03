import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, isPushKey } from "@/lib/push/endpoint";
import { runNotificationJob, type JobDeps, type SendOutcome, type Subscription } from "@/lib/push/job";

describe("push sign-up addresses", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://web.push.apple.com/QGx8",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])("accepts a real push service: %s", (url) => expect(isAllowedPushEndpoint(url)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://evil.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example/x",
    "https://127.0.0.1/push",
    "https://localhost/push",
    ["https://", ["someone", "made-up"].join(":"), "@fcm.googleapis.com/x"].join(""),
    "https://fcm.googleapis.com:8443/x",
    "javascript:alert(1)",
    "not a url",
    42,
    `https://fcm.googleapis.com/${"a".repeat(1000)}`,
  ])("refuses anything else: %s", (url) => expect(isAllowedPushEndpoint(url)).toBe(false));

  it("checks the browser's keys are short base64url text", () => {
    expect(isPushKey("tBHItJI5svbpez7KI4CCXg", 100)).toBe(true);
    expect(isPushKey("has space", 100)).toBe(false);
    expect(isPushKey("", 100)).toBe(false);
    expect(isPushKey("a".repeat(101), 100)).toBe(false);
  });
});

function fakeDeps(subs: Record<string, Subscription[]>, outcomes: Record<string, SendOutcome>) {
  const log = { sent: [] as string[], removed: [] as string[], marked: [] as [string, number][] };
  const deps: JobDeps = {
    claim: async () => Object.keys(subs).map((account, i) => ({ id: `note-${i}`, account_id: account })),
    subscriptionsFor: async (account) => subs[account] ?? [],
    send: async (sub, payload) => {
      log.sent.push(`${sub.endpoint}|${JSON.parse(payload).url}`);
      return outcomes[sub.endpoint];
    },
    removeSubscription: async (account, id) => void log.removed.push(`${account}:${id}`),
    markSent: async (_account, id, devices) => void log.marked.push([id, devices]),
  };
  return { deps, log };
}
const sub = (id: string): Subscription => ({ id, endpoint: `e-${id}`, p256dh: "k", auth: "a" });

describe("the notification job", () => {
  it("sends to every device of the account, removes dropped ones, and records how many got it", async () => {
    const { deps, log } = fakeDeps({ acct1: [sub("1"), sub("2"), sub("3")] }, { "e-1": "sent", "e-2": "gone", "e-3": "sent" });
    expect(await runNotificationJob(deps)).toEqual({ notifications: 1, sent: 2, failed: 0, removed: 1 });
    expect(log.sent).toEqual(["e-1|/notifications", "e-2|/notifications", "e-3|/notifications"]);
    expect(log.removed).toEqual(["acct1:2"]);
    expect(log.marked).toEqual([["note-0", 2]]);
  });

  it("records 0 devices when the account has none, so HQ can say nothing was sent", async () => {
    const { deps, log } = fakeDeps({ acct1: [] }, {});
    await runNotificationJob(deps);
    expect(log.marked).toEqual([["note-0", 0]]);
  });

  it("leaves a notification to retry when every send failed for a passing reason", async () => {
    const { deps, log } = fakeDeps({ acct1: [sub("1")] }, { "e-1": "failed" });
    expect(await runNotificationJob(deps)).toEqual({ notifications: 1, sent: 0, failed: 1, removed: 0 });
    expect(log.marked).toEqual([]);
  });

  it("marks it sent when at least one device got it", async () => {
    const { deps, log } = fakeDeps({ acct1: [sub("1"), sub("2")] }, { "e-1": "failed", "e-2": "sent" });
    await runNotificationJob(deps);
    expect(log.marked).toEqual([["note-0", 1]]);
  });
});
