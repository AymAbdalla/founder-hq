import { describe, expect, it } from "vitest";
import { isWaiting, todayGroups } from "@/lib/items/views";

type T = Parameters<typeof todayGroups>[0][number] & { n: string };
const TODAY = "2026-11-02";
const active = { id: "p", name: "P", status: "active" as const };

function item(n: string, over: Partial<T> = {}): T {
  return { n, kind: "todo", due_date: null, done_at: null, waitsOn: [], project: active, ...over };
}
const names = (xs: T[]) => xs.map((x) => x.n);

describe("todayGroups", () => {
  it("sorts open items into the five groups, keeping input order", () => {
    const g = todayGroups(
      [
        item("late2", { due_date: "2026-10-30" }),
        item("now", { due_date: "2026-11-02" }),
        item("tomorrow", { due_date: "2026-11-03" }),
        item("day7", { due_date: "2026-11-09" }),
        item("day8", { due_date: "2026-11-10" }),
        item("none"),
        item("late1", { due_date: "2026-11-01" }),
      ],
      TODAY,
    );
    expect(names(g.overdue)).toEqual(["late2", "late1"]);
    expect(names(g.today)).toEqual(["now"]);
    expect(names(g.week)).toEqual(["tomorrow", "day7"]);
    expect(names(g.later)).toEqual(["day8"]);
    expect(names(g.undated)).toEqual(["none"]);
  });

  it("leaves out done items", () => {
    const g = todayGroups([item("d", { done_at: "2026-11-01T10:00:00Z", due_date: TODAY })], TODAY);
    expect(g.today).toEqual([]);
  });

  it("leaves out an item while it waits, and shows it once the blocker is done", () => {
    const waiting = item("w", { due_date: TODAY, waitsOn: [{ id: "x", title: "X", done: false }] });
    expect(names(todayGroups([waiting], TODAY).today)).toEqual([]);
    const ready = item("w", { due_date: TODAY, waitsOn: [{ id: "x", title: "X", done: true }] });
    expect(names(todayGroups([ready], TODAY).today)).toEqual(["w"]);
    const half = item("w", {
      due_date: TODAY,
      waitsOn: [
        { id: "x", title: "X", done: true },
        { id: "y", title: "Y", done: false },
      ],
    });
    expect(names(todayGroups([half], TODAY).today)).toEqual([]);
  });

  it("leaves out items in an archived project but keeps paused and Inbox items", () => {
    const g = todayGroups(
      [
        item("arch", { due_date: TODAY, project: { id: "a", name: "A", status: "archived" } }),
        item("paused", { due_date: TODAY, project: { id: "b", name: "B", status: "paused" } }),
        item("inbox", { due_date: TODAY, project: null }),
      ],
      TODAY,
    );
    expect(names(g.today)).toEqual(["paused", "inbox"]);
  });

  it("leaves out ideas with no date but keeps dated ideas", () => {
    const g = todayGroups([item("i1", { kind: "idea" }), item("i2", { kind: "idea", due_date: "2026-11-04" })], TODAY);
    expect(names(g.undated)).toEqual([]);
    expect(names(g.week)).toEqual(["i2"]);
  });
});

describe("isWaiting", () => {
  it("is true only when some blocker is not done", () => {
    expect(isWaiting({ waitsOn: [] })).toBe(false);
    expect(isWaiting({ waitsOn: [{ id: "1", title: "a", done: true }] })).toBe(false);
    expect(isWaiting({ waitsOn: [{ id: "1", title: "a", done: false }] })).toBe(true);
  });
});
