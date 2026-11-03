import { describe, expect, it } from "vitest";
import { doneByDay, lastDays, level, monthTotals, projectSummary, weekday, yearGrid } from "@/lib/activity";

describe("doneByDay", () => {
  it("counts by calendar day in the given zone", () => {
    const at = ["2026-11-02T23:30:00Z", "2026-11-02T10:00:00Z"];
    expect(Object.fromEntries(doneByDay(at, "Europe/Berlin"))).toEqual({ "2026-11-03": 1, "2026-11-02": 1 });
    expect(Object.fromEntries(doneByDay(at, "America/New_York"))).toEqual({ "2026-11-02": 2 });
  });
  it("is empty for no input", () => {
    expect(doneByDay([], "UTC").size).toBe(0);
  });
});

describe("lastDays", () => {
  it("returns n days ending today, oldest first, padding zeros", () => {
    const counts = new Map([["2026-11-03", 2], ["2026-11-01", 5], ["2026-10-01", 9]]);
    expect(lastDays(counts, "2026-11-03", 4)).toEqual([
      { date: "2026-10-31", count: 0 },
      { date: "2026-11-01", count: 5 },
      { date: "2026-11-02", count: 0 },
      { date: "2026-11-03", count: 2 },
    ]);
  });
  it("crosses a month boundary", () => {
    expect(lastDays(new Map(), "2026-03-01", 2).map((d) => d.date)).toEqual(["2026-02-28", "2026-03-01"]);
  });
});

describe("level", () => {
  it.each([
    [0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [7, 3], [8, 4], [30, 4],
  ])("count %i is level %i", (count, expected) => {
    expect(level(count)).toBe(expected);
  });
});

describe("weekday", () => {
  it("gives 0 for Sunday to 6 for Saturday", () => {
    expect(weekday("2026-11-01")).toBe(0);
    expect(weekday("2026-11-03")).toBe(2);
    expect(weekday("2026-11-07")).toBe(6);
  });
});

describe("yearGrid", () => {
  const counts = new Map([["2026-11-03", 3], ["2026-11-01", 1], ["2025-11-02", 4], ["2025-11-01", 50], ["2026-11-04", 70]]);
  const g = yearGrid(counts, "2026-11-03", 53);

  it("has 53 columns of 7, starting on a Sunday a year back", () => {
    expect(g.cells).toHaveLength(371);
    expect(g.months).toHaveLength(53);
    expect(g.cells[0]).toEqual({ date: "2025-11-02", count: 4 });
  });
  it("ends with the week holding today, then empty days", () => {
    const last = g.cells.slice(364);
    expect(last.slice(0, 3)).toEqual([
      { date: "2026-11-01", count: 1 },
      { date: "2026-11-02", count: 0 },
      { date: "2026-11-03", count: 3 },
    ]);
    expect(last.slice(3)).toEqual([null, null, null, null]);
  });
  it("totals only counts inside the range", () => {
    expect(g.total).toBe(8);
    expect(g.today).toEqual({ date: "2026-11-03", count: 3 });
  });
  it("labels the first column of each month, never the last two", () => {
    const labelled = g.months.map((m, i) => [i, m]).filter(([, m]) => m !== null);
    expect(labelled).toEqual([
      [0, "Nov"], [5, "Dec"], [9, "Jan"], [13, "Feb"], [17, "Mar"], [22, "Apr"],
      [26, "May"], [31, "Jun"], [35, "Jul"], [39, "Aug"], [44, "Sep"], [48, "Oct"],
    ]);
  });
});

describe("monthTotals", () => {
  it("sums per calendar month, oldest first", () => {
    const days = [
      { date: "2026-10-31", count: 2 },
      { date: "2026-11-01", count: 1 },
      { date: "2026-11-02", count: 0 },
      { date: "2026-11-03", count: 4 },
    ];
    expect(monthTotals(days)).toEqual([{ month: "Oct 2026", count: 2 }, { month: "Nov 2026", count: 5 }]);
  });
  it("is empty for no days", () => {
    expect(monthTotals([])).toEqual([]);
  });
});

describe("projectSummary", () => {
  const base = { kind: "todo" as const, done_at: null, due_date: null, due_time: null, created_at: "2026-10-01T00:00:00Z", waitsOn: [] };
  const mk = (id: string, over: Partial<Parameters<typeof projectSummary>[0][number]> = {}) => ({ ...base, id, title: `t-${id}`, ...over });
  const run = (items: ReturnType<typeof mk>[]) => projectSummary(items, "2026-11-03", "UTC");

  it("picks the first open, unblocked, non-idea item in input order", () => {
    const s = run([
      mk("done", { done_at: "2026-11-01T10:00:00Z" }),
      mk("idea", { kind: "idea" }),
      mk("wait", { waitsOn: [{ id: "x", title: "X", done: false }] }),
      mk("ok1"),
      mk("ok2"),
    ]);
    expect(s.next).toEqual({ id: "ok1", title: "t-ok1" });
  });
  it("does not skip an item whose blocker is done", () => {
    const s = run([mk("a", { waitsOn: [{ id: "x", title: "X", done: true }] })]);
    expect(s.next?.id).toBe("a");
  });
  it("has no next step when nothing qualifies", () => {
    expect(run([mk("idea", { kind: "idea" })]).next).toBeNull();
    expect(run([]).next).toBeNull();
  });
  it("counts open items of any kind", () => {
    const s = run([mk("a"), mk("b", { kind: "idea" }), mk("c", { done_at: "2026-11-01T10:00:00Z" })]);
    expect(s.open).toBe(2);
  });
  it("finds the most recently done item", () => {
    const s = run([
      mk("a", { done_at: "2026-11-01T10:00:00Z" }),
      mk("b", { done_at: "2026-11-02T08:00:00Z" }),
      mk("c", { done_at: "2026-10-30T10:00:00Z" }),
    ]);
    expect(s.latest).toEqual({ title: "t-b", done_at: "2026-11-02T08:00:00Z" });
    expect(run([mk("a")]).latest).toBeNull();
  });
  it("gives seven days of done counts", () => {
    const s = run([
      mk("a", { done_at: "2026-11-03T08:00:00Z" }),
      mk("b", { done_at: "2026-11-03T09:00:00Z" }),
      mk("c", { done_at: "2026-10-28T09:00:00Z" }),
      mk("d", { done_at: "2026-10-01T09:00:00Z" }),
    ]);
    expect(s.week.map((d) => d.date)).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(s.week.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });
});
