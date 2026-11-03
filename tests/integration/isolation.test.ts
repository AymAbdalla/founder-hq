import { beforeAll, describe, expect, it } from "vitest";
import { anonymousClient, newSignedInAccount, type TestAccount } from "../support/accounts";

// Spec P1 and plan slice 5: each account's data is private to that account, enforced by
// the database itself (row-level security). Runs against local Supabase, on the real projects table.
let a: TestAccount;
let b: TestAccount;
let aRowId: string;

beforeAll(async () => {
  a = await newSignedInAccount("iso-a");
  b = await newSignedInAccount("iso-b");
  const { data, error } = await a.db.from("projects").insert({ name: "A's private project" }).select("id").single();
  if (error) throw new Error(`A could not add its own row: ${error.message}`);
  aRowId = data.id;
});

describe("two-account isolation", () => {
  it("lets A read its own row", async () => {
    const { data } = await a.db.from("projects").select("id, name").eq("id", aRowId);
    expect(data).toEqual([{ id: aRowId, name: "A's private project" }]);
  });

  it("never shows A's row to B", async () => {
    const { data } = await b.db.from("projects").select("id");
    expect(data?.map((r) => r.id) ?? []).not.toContain(aRowId);
  });

  it("does not let B change A's row", async () => {
    await b.db.from("projects").update({ name: "changed by B" }).eq("id", aRowId);
    const { data } = await a.db.from("projects").select("name").eq("id", aRowId).single();
    expect(data?.name).toBe("A's private project");
  });

  it("does not let B delete A's row", async () => {
    await b.db.from("projects").delete().eq("id", aRowId);
    const { data } = await a.db.from("projects").select("id").eq("id", aRowId);
    expect(data).toHaveLength(1);
  });

  it("does not let B add a row in A's name", async () => {
    const { error } = await b.db.from("projects").insert({ name: "planted by B", account_id: a.id });
    expect(error).not.toBeNull();
    const { data } = await a.db.from("projects").select("name");
    expect(data?.map((r) => r.name)).not.toContain("planted by B");
  });

  it("does not let B move its own project into A's account", async () => {
    const { data: mine, error } = await b.db.from("projects").insert({ name: "B's own project" }).select("id").single();
    expect(error).toBeNull();
    const moved = await b.db.from("projects").update({ account_id: a.id }).eq("id", mine!.id);
    expect(moved.error).not.toBeNull();
    const { data } = await a.db.from("projects").select("name");
    expect(data?.map((r) => r.name)).not.toContain("B's own project");
    const { data: still } = await b.db.from("projects").select("id").eq("id", mine!.id);
    expect(still).toHaveLength(1);
  });

  it("shows nothing to someone who is not signed in", async () => {
    const { data } = await anonymousClient().from("projects").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("does not let someone who is not signed in add a project", async () => {
    const { error } = await anonymousClient().from("projects").insert({ name: "anon plant", account_id: a.id });
    expect(error).not.toBeNull();
  });
});

describe("two-account isolation: items and waits", () => {
  let aItem: string;
  let aOther: string;
  let aProject: string;

  beforeAll(async () => {
    const proj = await a.db.from("projects").insert({ name: "A's item home" }).select("id").single();
    aProject = proj.data!.id;
    const one = await a.db.from("items").insert({ title: "A's private item", project_id: aProject }).select("id").single();
    const two = await a.db.from("items").insert({ title: "A's other item" }).select("id").single();
    aItem = one.data!.id;
    aOther = two.data!.id;
  });

  it("never shows A's items to B", async () => {
    const { data } = await b.db.from("items").select("id");
    expect(data?.map((r) => r.id) ?? []).not.toContain(aItem);
  });

  it("does not let B change or tick A's item", async () => {
    await b.db.from("items").update({ title: "changed by B" }).eq("id", aItem);
    await b.db.from("items").update({ done_at: new Date().toISOString() }).eq("id", aItem);
    const { data } = await a.db.from("items").select("title, done_at").eq("id", aItem).single();
    expect(data).toEqual({ title: "A's private item", done_at: null });
  });

  it("does not let B delete A's item", async () => {
    await b.db.from("items").delete().eq("id", aItem);
    const { data } = await a.db.from("items").select("id").eq("id", aItem);
    expect(data).toHaveLength(1);
  });

  it("does not let B put an item into A's project", async () => {
    const { error } = await b.db.from("items").insert({ title: "planted by B", project_id: aProject });
    expect(error).not.toBeNull();
    const { data } = await a.db.from("items").select("title");
    expect(data?.map((r) => r.title)).not.toContain("planted by B");
  });

  it("does not let B create an item in A's account", async () => {
    const { error } = await b.db.from("items").insert({ title: "forged by B", account_id: a.id });
    expect(error).not.toBeNull();
  });

  it("does not let B add a wait that links to A's items", async () => {
    const mine = await b.db.from("items").insert({ title: "B's item" }).select("id").single();
    const one = await b.db.from("item_waits").insert({ item_id: mine.data!.id, waits_on_id: aItem });
    expect(one.error).not.toBeNull();
    const two = await b.db.from("item_waits").insert({ item_id: aItem, waits_on_id: mine.data!.id });
    expect(two.error).not.toBeNull();
    const three = await b.db.from("item_waits").insert({ item_id: aItem, waits_on_id: aOther, account_id: a.id });
    expect(three.error).not.toBeNull();
  });

  it("hides A's waits from B and does not let B remove them", async () => {
    expect((await a.db.from("item_waits").insert({ item_id: aItem, waits_on_id: aOther })).error).toBeNull();
    expect((await b.db.from("item_waits").select("item_id")).data).toEqual([]);
    await b.db.from("item_waits").delete().eq("item_id", aItem);
    expect((await a.db.from("item_waits").select("item_id").eq("item_id", aItem)).data).toHaveLength(1);
  });

  it("shows nothing to someone who is not signed in", async () => {
    expect((await anonymousClient().from("items").select("id")).data ?? []).toEqual([]);
    expect((await anonymousClient().from("item_waits").select("item_id")).data ?? []).toEqual([]);
  });
});
