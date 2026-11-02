import { beforeAll, describe, expect, it } from "vitest";
import { anonymousClient, newSignedInAccount, type TestAccount } from "../support/accounts";

// Spec P1 and plan slice 2: each account's data is private to that account, enforced by
// the database itself (row-level security). Runs against local Supabase.
let a: TestAccount;
let b: TestAccount;
let aRowId: string;

beforeAll(async () => {
  a = await newSignedInAccount("iso-a");
  b = await newSignedInAccount("iso-b");
  const { data, error } = await a.db.from("isolation_probe").insert({ label: "A's private row" }).select("id").single();
  if (error) throw new Error(`A could not add its own row: ${error.message}`);
  aRowId = data.id;
});

describe("two-account isolation", () => {
  it("lets A read its own row", async () => {
    const { data } = await a.db.from("isolation_probe").select("id, label").eq("id", aRowId);
    expect(data).toEqual([{ id: aRowId, label: "A's private row" }]);
  });

  it("never shows A's row to B", async () => {
    const { data } = await b.db.from("isolation_probe").select("id");
    expect(data?.map((r) => r.id) ?? []).not.toContain(aRowId);
  });

  it("does not let B change A's row", async () => {
    await b.db.from("isolation_probe").update({ label: "changed by B" }).eq("id", aRowId);
    const { data } = await a.db.from("isolation_probe").select("label").eq("id", aRowId).single();
    expect(data?.label).toBe("A's private row");
  });

  it("does not let B delete A's row", async () => {
    await b.db.from("isolation_probe").delete().eq("id", aRowId);
    const { data } = await a.db.from("isolation_probe").select("id").eq("id", aRowId);
    expect(data).toHaveLength(1);
  });

  it("does not let B add a row in A's name", async () => {
    const { error } = await b.db.from("isolation_probe").insert({ label: "planted by B", account_id: a.id });
    expect(error).not.toBeNull();
    const { data } = await a.db.from("isolation_probe").select("label");
    expect(data?.map((r) => r.label)).not.toContain("planted by B");
  });

  it("shows nothing to someone who is not signed in", async () => {
    const { data } = await anonymousClient().from("isolation_probe").select("id");
    expect(data ?? []).toEqual([]);
  });
});
