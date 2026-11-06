import { describe, expect, it } from "vitest";
import { allRows } from "@/lib/supabase/all-rows";

// A stand-in for the database API: `total` rows, at most `cap` per request, like PostgREST's
// max_rows. It reports the full count only when asked, like `select(..., { count: "exact" })`.
function fakeTable(total: number, cap: number, withCount = true) {
  const rows = Array.from({ length: total }, (_, i) => ({ n: i }));
  const calls: [number, number][] = [];
  const range = (from: number, to: number) => {
    calls.push([from, to]);
    const data = rows.slice(from, Math.min(to + 1, from + cap));
    return Promise.resolve({ data, error: null, count: withCount ? total : null });
  };
  return { range, calls };
}

describe("allRows", () => {
  it("loads a short list in one request", async () => {
    const table = fakeTable(5, 1000);
    const result = await allRows(table.range);
    expect(result.data).toHaveLength(5);
    expect(table.calls).toHaveLength(1);
  });

  it("loads an empty list in one request", async () => {
    const table = fakeTable(0, 1000);
    const result = await allRows(table.range);
    expect(result.data).toEqual([]);
    expect(table.calls).toHaveLength(1);
  });

  it("keeps asking until every row of a long list is in", async () => {
    const table = fakeTable(2500, 1000);
    const result = await allRows(table.range);
    expect(result.data?.map((r) => r.n)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(table.calls).toHaveLength(3);
  });

  it("is never cut short when the server's cap is smaller than the page asked for", async () => {
    const table = fakeTable(700, 300);
    const result = await allRows(table.range);
    expect(result.data).toHaveLength(700);
  });

  it("still loads everything when the query did not ask for a count", async () => {
    const table = fakeTable(1200, 1000, false);
    const result = await allRows(table.range);
    expect(result.data).toHaveLength(1200);
  });

  it("passes a database error on", async () => {
    const result = await allRows(() => Promise.resolve({ data: null, error: { code: "42501" }, count: null }));
    expect(result).toEqual({ data: null, error: { code: "42501" } });
  });
});
