import { beforeAll, describe, expect, it } from "vitest";
import { newSignedInAccount, type TestAccount } from "../support/accounts";

// Spec P10, P12, "Waiting on", P8 and plan slice 6: what items and waits accept and refuse. Local Supabase.
let a: TestAccount;
let b: TestAccount;
let projectId: string;

beforeAll(async () => {
  a = await newSignedInAccount("items-a");
  b = await newSignedInAccount("items-b");
  const { data, error } = await a.db.from("projects").insert({ name: "Items home" }).select("id").single();
  if (error) throw new Error(error.message);
  projectId = data.id;
});

const add = (who: TestAccount, row: Record<string, unknown>) => who.db.from("items").insert(row).select("*").single();
const wait = (who: TestAccount, item: string, on: string) =>
  who.db.from("item_waits").insert({ item_id: item, waits_on_id: on });
const mk = async (title: string, row: Record<string, unknown> = {}) => (await add(a, { title, ...row })).data!.id as string;

describe("item fields and limits", () => {
  it("creates an item with only a title, defaulting to a to-do in the Inbox", async () => {
    const { data, error } = await add(a, { title: "Plain" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ title: "Plain", kind: "todo", project_id: null, account_id: a.id, notes: null, done_at: null });
  });

  it("refuses blank and whitespace titles, accepts 200 and refuses 201", async () => {
    expect((await add(a, { title: "" })).error).not.toBeNull();
    expect((await add(a, { title: "   " })).error).not.toBeNull();
    expect((await add(a, { title: "t".repeat(200) })).error).toBeNull();
    expect((await add(a, { title: "t".repeat(201) })).error).not.toBeNull();
  });

  it("limits notes to 10000 characters", async () => {
    expect((await add(a, { title: "N", notes: "x".repeat(10000) })).error).toBeNull();
    expect((await add(a, { title: "N", notes: "x".repeat(10001) })).error).not.toBeNull();
  });

  it("refuses an unknown kind", async () => {
    expect((await add(a, { title: "K", kind: "epic" })).error).not.toBeNull();
    for (const kind of ["idea", "feature"]) expect((await add(a, { title: "K", kind })).error).toBeNull();
  });

  it("refuses a reminder without a date and accepts one with a date", async () => {
    expect((await add(a, { title: "R", kind: "reminder" })).error).not.toBeNull();
    expect((await add(a, { title: "R", kind: "reminder", due_date: "2026-11-05" })).error).toBeNull();
  });

  it("refuses a time without a date", async () => {
    expect((await add(a, { title: "T", due_time: "09:00" })).error).not.toBeNull();
    expect((await add(a, { title: "T", due_date: "2026-11-05", due_time: "09:00" })).error).toBeNull();
  });

  it("accepts an item in the account's own project", async () => {
    const { data, error } = await add(a, { title: "Homed", project_id: projectId });
    expect(error).toBeNull();
    expect(data!.project_id).toBe(projectId);
  });

  it("refuses an item that points at another account's project, on insert and on update", async () => {
    const { data: theirs } = await b.db.from("projects").insert({ name: "B's project" }).select("id").single();
    expect((await add(a, { title: "Sneaky", project_id: theirs!.id })).error).not.toBeNull();
    const id = await mk("Mine");
    const r = await a.db.from("items").update({ project_id: theirs!.id }).eq("id", id).select("id");
    expect(r.error).not.toBeNull();
  });

  it("moves updated_at forward on update", async () => {
    const { data: row } = await add(a, { title: "Clock" });
    await new Promise((r) => setTimeout(r, 50));
    const { data: after } = await a.db.from("items").update({ title: "Clock 2" }).eq("id", row!.id).select("*").single();
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(row!.updated_at).getTime());
    expect(after!.created_at).toBe(row!.created_at);
  });
});

describe("waits", () => {
  it("refuses an item waiting on itself", async () => {
    const x = await mk("Self");
    expect((await wait(a, x, x)).error).not.toBeNull();
  });

  it("adds a wait and refuses a duplicate", async () => {
    const x = await mk("W1");
    const y = await mk("W2");
    expect((await wait(a, x, y)).error).toBeNull();
    expect((await wait(a, x, y)).error?.code).toBe("23505");
  });

  it("refuses a two-step cycle", async () => {
    const x = await mk("C1");
    const y = await mk("C2");
    expect((await wait(a, x, y)).error).toBeNull();
    const back = await wait(a, y, x);
    expect(back.error?.message).toBe("waits_cycle");
  });

  it("refuses a three-step cycle", async () => {
    const x = await mk("D1");
    const y = await mk("D2");
    const z = await mk("D3");
    expect((await wait(a, x, y)).error).toBeNull();
    expect((await wait(a, y, z)).error).toBeNull();
    expect((await wait(a, z, x)).error?.message).toBe("waits_cycle");
  });

  it("removes the wait when the waited-on item is deleted", async () => {
    const x = await mk("E1");
    const y = await mk("E2");
    await wait(a, x, y);
    await a.db.from("items").delete().eq("id", y);
    const { data } = await a.db.from("item_waits").select("item_id").eq("item_id", x);
    expect(data).toEqual([]);
  });

  it("removes a wait on request", async () => {
    const x = await mk("F1");
    const y = await mk("F2");
    await wait(a, x, y);
    await a.db.from("item_waits").delete().eq("item_id", x).eq("waits_on_id", y);
    const { data } = await a.db.from("item_waits").select("item_id").eq("item_id", x);
    expect(data).toEqual([]);
  });
});

describe("delete_project", () => {
  const make = async (name: string) => {
    const { data } = await a.db.from("projects").insert({ name }).select("id").single();
    const item = await mk(`${name} item`, { project_id: data!.id });
    return { project: data!.id as string, item };
  };

  it("keeps the items in the Inbox when keep_items is true", async () => {
    const { project, item } = await make("Keep me");
    const r = await a.db.rpc("delete_project", { target: project, keep_items: true });
    expect(r.error).toBeNull();
    expect(r.data).toBe(true);
    const { data } = await a.db.from("items").select("project_id").eq("id", item).single();
    expect(data!.project_id).toBeNull();
    expect((await a.db.from("projects").select("id").eq("id", project)).data).toEqual([]);
  });

  it("deletes the items when keep_items is false", async () => {
    const { project, item } = await make("Drop me");
    const r = await a.db.rpc("delete_project", { target: project, keep_items: false });
    expect(r.data).toBe(true);
    expect((await a.db.from("items").select("id").eq("id", item)).data).toEqual([]);
  });

  it("returns false and deletes nothing for another account's project", async () => {
    const { project, item } = await make("Not yours");
    const r = await b.db.rpc("delete_project", { target: project, keep_items: false });
    expect(r.error).toBeNull();
    expect(r.data).toBe(false);
    expect((await a.db.from("projects").select("id").eq("id", project)).data).toHaveLength(1);
    expect((await a.db.from("items").select("id").eq("id", item)).data).toHaveLength(1);
  });

  it("returns false for a project that does not exist", async () => {
    const r = await a.db.rpc("delete_project", { target: "00000000-0000-4000-8000-000000000000", keep_items: true });
    expect(r.data).toBe(false);
  });
});
