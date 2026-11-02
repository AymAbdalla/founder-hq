import { beforeAll, describe, expect, it } from "vitest";
import { newSignedInAccount, type TestAccount } from "../support/accounts";

// Spec P6, P7 and plan slice 5: what the projects table accepts and refuses. Local Supabase.
let a: TestAccount;
let b: TestAccount;

beforeAll(async () => {
  a = await newSignedInAccount("proj-a");
  b = await newSignedInAccount("proj-b");
});

const add = (who: TestAccount, row: Record<string, unknown>) =>
  who.db.from("projects").insert(row).select("*").single();

describe("project fields and limits", () => {
  it("creates a project with only a name, defaulting to active", async () => {
    const { data, error } = await add(a, { name: "Plain" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: "Plain", status: "active", account_id: a.id, kind: null, summary: null, notes: null });
  });

  it("refuses a blank name", async () => {
    expect((await add(a, { name: "" })).error).not.toBeNull();
  });

  it("refuses a whitespace-only name", async () => {
    expect((await add(a, { name: "   " })).error).not.toBeNull();
  });

  it("accepts an 80-character name and refuses 81", async () => {
    expect((await add(a, { name: "n".repeat(80) })).error).toBeNull();
    expect((await add(a, { name: "n".repeat(81) })).error).not.toBeNull();
  });

  it("refuses a kind over 40, a summary over 200 and notes over 10000", async () => {
    expect((await add(a, { name: "K1", kind: "k".repeat(41) })).error).not.toBeNull();
    expect((await add(a, { name: "S1", summary: "s".repeat(201) })).error).not.toBeNull();
    expect((await add(a, { name: "N1", notes: "x".repeat(10001) })).error).not.toBeNull();
    expect((await add(a, { name: "Edge", kind: "k".repeat(40), summary: "s".repeat(200), notes: "x".repeat(10000) })).error).toBeNull();
  });

  it("refuses a status other than active, paused or archived", async () => {
    expect((await add(a, { name: "Bad status", status: "deleted" })).error).not.toBeNull();
  });
});

describe("project names", () => {
  it("refuses the same name in one account, ignoring case and surrounding spaces", async () => {
    expect((await add(a, { name: "Orbit" })).error).toBeNull();
    const dup = await add(a, { name: " orbit " });
    expect(dup.error?.code).toBe("23505");
  });

  it("lets a different account use the same name", async () => {
    const { error } = await add(b, { name: "Orbit" });
    expect(error).toBeNull();
  });

  it("refuses renaming a project to another one's name", async () => {
    await add(a, { name: "Rename one" });
    const { data } = await add(a, { name: "Rename two" });
    const r = await a.db.from("projects").update({ name: "RENAME ONE" }).eq("id", data!.id);
    expect(r.error?.code).toBe("23505");
  });
});

describe("project changes", () => {
  it("moves updated_at forward on every update and leaves created_at alone", async () => {
    const { data: row } = await add(a, { name: "Clock" });
    await new Promise((r) => setTimeout(r, 50));
    const { data: after, error } = await a.db.from("projects").update({ summary: "changed" }).eq("id", row!.id).select("*").single();
    expect(error).toBeNull();
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(row!.updated_at).getTime());
    expect(after!.created_at).toBe(row!.created_at);
  });

  it("pauses, archives and reopens a project", async () => {
    const { data: row } = await add(a, { name: "Lifecycle" });
    for (const status of ["paused", "archived", "active"]) {
      const { data, error } = await a.db.from("projects").update({ status }).eq("id", row!.id).select("status").single();
      expect(error).toBeNull();
      expect(data?.status).toBe(status);
    }
  });

  it("deletes a project", async () => {
    const { data: row } = await add(a, { name: "Doomed" });
    const { error } = await a.db.from("projects").delete().eq("id", row!.id);
    expect(error).toBeNull();
    const { data } = await a.db.from("projects").select("id").eq("id", row!.id);
    expect(data).toEqual([]);
  });
});
