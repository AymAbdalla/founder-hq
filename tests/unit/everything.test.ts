import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER, filterEverything, parseEverythingFilter } from "@/lib/items/everything";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

describe("parseEverythingFilter", () => {
  it("defaults when empty", () => {
    expect(parseEverythingFilter({})).toEqual({ q: "", kind: "all", status: "all", project: "all" });
    expect(DEFAULT_FILTER).toEqual({ q: "", kind: "all", status: "all", project: "all" });
  });
  it("reads valid values, taking the first of a list", () => {
    expect(parseEverythingFilter({ q: ["milk", "x"], kind: "idea", status: "done", project: P1 })).toEqual({ q: "milk", kind: "idea", status: "done", project: P1 });
    expect(parseEverythingFilter({ project: "inbox" }).project).toBe("inbox");
    expect(parseEverythingFilter({ project: "archived" }).project).toBe("archived");
  });
  it("falls back for bad values", () => {
    expect(parseEverythingFilter({ kind: "bogus", status: "maybe", project: "not-an-id" })).toEqual(DEFAULT_FILTER);
    expect(parseEverythingFilter({ kind: [], status: undefined })).toEqual(DEFAULT_FILTER);
  });
  it("trims q and cuts it to 100 characters", () => {
    expect(parseEverythingFilter({ q: "  hello  " }).q).toBe("hello");
    expect(parseEverythingFilter({ q: "a".repeat(150) }).q).toBe("a".repeat(100));
  });
});

type Row = Parameters<typeof filterEverything>[0][number] & { n: string };
const active = { id: P1, name: "A", status: "active" as const };
const archived = { id: P2, name: "B", status: "archived" as const };
function row(n: string, over: Partial<Row> = {}): Row {
  return { n, title: n, notes: null, kind: "todo", done_at: null, project_id: P1, project: active, ...over };
}
const names = (xs: Row[]) => xs.map((x) => x.n);
const f = (over: Partial<typeof DEFAULT_FILTER>) => ({ ...DEFAULT_FILTER, ...over });

describe("filterEverything", () => {
  it("matches text in title or notes, ignoring case", () => {
    const items = [row("Buy Milk"), row("other", { notes: "get MILK too" }), row("nothing")];
    expect(names(filterEverything(items, f({ q: "milk" })))).toEqual(["Buy Milk", "other"]);
    expect(names(filterEverything(items, f({ q: "" })))).toHaveLength(3);
  });
  it("filters by kind", () => {
    const items = [row("a"), row("b", { kind: "idea" })];
    expect(names(filterEverything(items, f({ kind: "idea" })))).toEqual(["b"]);
  });
  it("filters by status", () => {
    const items = [row("o"), row("d", { done_at: "2026-11-01T00:00:00Z" })];
    expect(names(filterEverything(items, f({ status: "open" })))).toEqual(["o"]);
    expect(names(filterEverything(items, f({ status: "done" })))).toEqual(["d"]);
  });
  it("project all hides archived projects but keeps Inbox", () => {
    const items = [row("in", { project_id: null, project: null }), row("act"), row("arc", { project_id: P2, project: archived })];
    expect(names(filterEverything(items, f({})))).toEqual(["in", "act"]);
  });
  it("project inbox, archived and a specific id", () => {
    const items = [row("in", { project_id: null, project: null }), row("act"), row("arc", { project_id: P2, project: archived })];
    expect(names(filterEverything(items, f({ project: "inbox" })))).toEqual(["in"]);
    expect(names(filterEverything(items, f({ project: "archived" })))).toEqual(["arc"]);
    expect(names(filterEverything(items, f({ project: P1 })))).toEqual(["act"]);
    expect(names(filterEverything(items, f({ project: P2 })))).toEqual(["arc"]);
  });
  it("combines filters", () => {
    const items = [row("milk idea", { kind: "idea" }), row("milk todo"), row("tea idea", { kind: "idea" })];
    expect(names(filterEverything(items, f({ q: "milk", kind: "idea", status: "open" })))).toEqual(["milk idea"]);
  });
  it("lists open first in input order, then done newest first", () => {
    const items = [
      row("d-old", { done_at: "2026-10-01T00:00:00Z" }),
      row("o1"),
      row("d-new", { done_at: "2026-11-02T00:00:00Z" }),
      row("o2"),
    ];
    expect(names(filterEverything(items, f({})))).toEqual(["o1", "o2", "d-new", "d-old"]);
  });
});
