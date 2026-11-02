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
