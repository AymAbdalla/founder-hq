import { beforeAll, describe, expect, it } from "vitest";
import { anonymousClient, newSignedInAccount, type TestAccount } from "../support/accounts";
import { localSql, sqlRows, sqlText } from "../support/db";

// Plan slice 3 and security rule S6: a device's notification sign-up belongs to the account
// signed in on it, moves to another account that signs in on the same browser, and is never
// visible to anyone else. Test notifications are queued per account, a few at a time, and
// only HQ's server can take due ones off the queue.
let a: TestAccount;
let b: TestAccount;
const endpoint = (label: string) => `https://fcm.googleapis.com/fcm/send/test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const keys = { p_p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", p_auth: "tBHItJI5svbpez7KI4CCXg" };

beforeAll(async () => {
  a = await newSignedInAccount("push-a");
  b = await newSignedInAccount("push-b");
});

const mine = async (who: TestAccount) => (await who.db.from("push_subscriptions").select("endpoint")).data ?? [];

describe("device notification sign-ups", () => {
  it("are saved for the signed-in account and readable only by it", async () => {
    const e = endpoint("own");
    expect((await a.db.rpc("register_push_subscription", { p_endpoint: e, ...keys })).error).toBeNull();
    expect((await mine(a)).map((r) => r.endpoint)).toContain(e);
    expect((await mine(b)).map((r) => r.endpoint)).not.toContain(e);
  });

  it("move to another account that signs in on the same browser (S6)", async () => {
    const e = endpoint("shared");
    await a.db.rpc("register_push_subscription", { p_endpoint: e, ...keys });
    await b.db.rpc("register_push_subscription", { p_endpoint: e, ...keys });
    expect((await mine(a)).map((r) => r.endpoint)).not.toContain(e);
    expect((await mine(b)).map((r) => r.endpoint)).toContain(e);
    expect(Number(sqlRows(`select count(*) as n from public.push_subscriptions where endpoint = ${sqlText(e)}`)[0].n)).toBe(1);
  });

  it("can't be written directly, only through the register function", async () => {
    const { error } = await a.db.from("push_subscriptions").insert({ endpoint: endpoint("direct"), p256dh: keys.p_p256dh, auth: keys.p_auth });
    expect(error).not.toBeNull();
  });

  it("can't be registered by someone who isn't signed in", async () => {
    const { error } = await anonymousClient().rpc("register_push_subscription", { p_endpoint: endpoint("anon"), ...keys });
    expect(error).not.toBeNull();
  });

  it("refuses an endpoint that isn't an https address", async () => {
    const { error } = await a.db.rpc("register_push_subscription", { p_endpoint: "http://example.test/push", ...keys });
    expect(error).not.toBeNull();
  });

  it("can be removed by its owner", async () => {
    const e = endpoint("remove");
    await a.db.rpc("register_push_subscription", { p_endpoint: e, ...keys });
    await a.db.from("push_subscriptions").delete().eq("endpoint", e);
    expect((await mine(a)).map((r) => r.endpoint)).not.toContain(e);
  });
});

describe("test notifications", () => {
  it("are queued a minute ahead, at most 3 waiting per account, and private to the account", async () => {
    const c = await newSignedInAccount("push-c");
    for (let i = 0; i < 3; i++) expect((await c.db.rpc("schedule_test_notification")).error).toBeNull();
    expect((await c.db.rpc("schedule_test_notification")).error).not.toBeNull();
    const { data } = await c.db.from("test_notifications").select("due_at, created_at");
    expect(data).toHaveLength(3);
    const lead = new Date(data![0].due_at).getTime() - new Date(data![0].created_at).getTime();
    expect(lead).toBeGreaterThanOrEqual(59_000);
    expect(lead).toBeLessThanOrEqual(61_000);
    expect((await a.db.from("test_notifications").select("id").eq("account_id", c.id)).data).toEqual([]);
  });

  it("can only be taken off the queue by HQ's server, once", async () => {
    const d = await newSignedInAccount("push-d");
    await d.db.rpc("schedule_test_notification");
    expect((await d.db.rpc("claim_due_test_notifications", { p_limit: 10 })).error?.code).toBe("42501");
    expect((await anonymousClient().rpc("claim_due_test_notifications", { p_limit: 10 })).error).not.toBeNull();

    localSql(`update public.test_notifications set due_at = now() - interval '1 second' where account_id = ${sqlText(d.id)}`);
    const claim = () => sqlRows(`select account_id from public.claim_due_test_notifications(50) where account_id = ${sqlText(d.id)}`);
    expect(claim()).toEqual([{ account_id: d.id }]);
    expect(claim()).toEqual([]);
  });
});
