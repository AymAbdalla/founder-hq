import { describe, expect, it } from "vitest";
import { isItemId, isItemKind, parseItemInput } from "@/lib/items/input";

const TODAY = "2026-11-02";
const PROJECT = "3f2b8c1e-5a4d-4e6f-8b7a-1c2d3e4f5a6b";

describe("parseItemInput", () => {
  it("returns clean values with defaults", () => {
    expect(parseItemInput({ title: "  Write intro " }, TODAY)).toEqual({
      ok: true,
      value: { title: "Write intro", kind: "todo", notes: null, project_id: null, due_date: null, due_time: null },
    });
  });

  it("keeps every field when given", () => {
    const r = parseItemInput(
      { title: "Call", kind: "reminder", notes: " n ", project: PROJECT, date: "2026-11-05", time: "09:05:00" },
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      value: { title: "Call", kind: "reminder", notes: "n", project_id: PROJECT, due_date: "2026-11-05", due_time: "09:05" },
    });
  });

  it("asks for a title", () => {
    for (const title of ["", "   ", undefined]) {
      expect(parseItemInput({ title }, TODAY)).toEqual({ ok: false, problems: ["Give the item a title."] });
    }
  });

  it("accepts 200 characters and refuses 201", () => {
    expect(parseItemInput({ title: "t".repeat(200) }, TODAY).ok).toBe(true);
    expect(parseItemInput({ title: "t".repeat(201) }, TODAY)).toEqual({
      ok: false,
      problems: ["Keep the title to 200 characters or fewer."],
    });
  });

  it("defaults a missing or empty kind to to-do and refuses unknown ones", () => {
    for (const kind of [undefined, ""]) {
      const r = parseItemInput({ title: "x", kind }, TODAY);
      expect(r.ok && r.value.kind).toBe("todo");
    }
    for (const kind of ["idea", "feature"]) {
      const r = parseItemInput({ title: "x", kind }, TODAY);
      expect(r.ok && r.value.kind).toBe(kind);
    }
    expect(parseItemInput({ title: "x", kind: "epic" }, TODAY)).toEqual({
      ok: false,
      problems: ["Choose to-do, reminder, idea or feature."],
    });
  });

  it("limits notes to 10,000 characters", () => {
    expect(parseItemInput({ title: "x", notes: "n".repeat(10000) }, TODAY).ok).toBe(true);
    expect(parseItemInput({ title: "x", notes: "n".repeat(10001) }, TODAY)).toEqual({
      ok: false,
      problems: ["Keep the notes to 10,000 characters or fewer."],
    });
    const blank = parseItemInput({ title: "x", notes: "  " }, TODAY);
    expect(blank.ok && blank.value.notes).toBeNull();
  });

  it("refuses a project that is not a valid id", () => {
    expect(parseItemInput({ title: "x", project: "not-an-id" }, TODAY)).toEqual({
      ok: false,
      problems: ["Choose a project from the list."],
    });
    const none = parseItemInput({ title: "x", project: "" }, TODAY);
    expect(none.ok && none.value.project_id).toBeNull();
  });

  it("refuses a bad date and a bad time", () => {
    expect(parseItemInput({ title: "x", date: "2026-02-30" }, TODAY)).toEqual({
      ok: false,
      problems: ["Enter the date as a calendar date."],
    });
    expect(parseItemInput({ title: "x", time: "9:5" }, TODAY)).toEqual({
      ok: false,
      problems: ["Enter the time as hours and minutes."],
    });
  });

  it("treats a time with no date as today", () => {
    expect(parseItemInput({ title: "x", time: "14:30" }, TODAY)).toEqual({
      ok: true,
      value: { title: "x", kind: "todo", notes: null, project_id: null, due_date: "2026-11-02", due_time: "14:30" },
    });
  });

  it("accepts a reminder with only a time (date becomes today)", () => {
    const r = parseItemInput({ title: "x", kind: "reminder", time: "08:00" }, TODAY);
    expect(r.ok && r.value.due_date).toBe("2026-11-02");
  });

  it("refuses a reminder with nothing", () => {
    expect(parseItemInput({ title: "x", kind: "reminder" }, TODAY)).toEqual({
      ok: false,
      problems: ["A reminder needs a date."],
    });
  });

  it("reports every problem in order", () => {
    expect(
      parseItemInput(
        { title: "", kind: "epic", notes: "n".repeat(10001), project: "zzz", date: "nope", time: "99:99" },
        TODAY,
      ),
    ).toEqual({
      ok: false,
      problems: [
        "Give the item a title.",
        "Choose to-do, reminder, idea or feature.",
        "Keep the notes to 10,000 characters or fewer.",
        "Choose a project from the list.",
        "Enter the date as a calendar date.",
        "Enter the time as hours and minutes.",
      ],
    });
  });
});

describe("isItemKind and isItemId", () => {
  it("check their input", () => {
    expect(isItemKind("idea")).toBe(true);
    expect(isItemKind("note")).toBe(false);
    expect(isItemId(PROJECT)).toBe(true);
    expect(isItemId("abc")).toBe(false);
    expect(isItemId(undefined)).toBe(false);
  });
});
