import { describe, expect, it } from "vitest";
import { parseProjectInput } from "@/lib/projects/input";

describe("parseProjectInput", () => {
  it("trims and returns clean values", () => {
    const r = parseProjectInput({ name: "  Orbit ", kind: " Product ", summary: " Tracks stuff ", notes: " hi ", status: "paused" });
    expect(r).toEqual({ ok: true, value: { name: "Orbit", kind: "Product", summary: "Tracks stuff", notes: "hi", status: "paused" } });
  });

  it("defaults status to active and turns empty optional fields into null", () => {
    const r = parseProjectInput({ name: "Orbit", kind: "  ", summary: "", notes: undefined });
    expect(r).toEqual({ ok: true, value: { name: "Orbit", kind: null, summary: null, notes: null, status: "active" } });
  });

  it("asks for a name when blank or missing", () => {
    for (const name of ["", "   ", undefined, null]) {
      const r = parseProjectInput({ name });
      expect(r).toEqual({ ok: false, problems: ["Give the project a name."] });
    }
  });

  it("accepts the limits and refuses one over", () => {
    expect(parseProjectInput({ name: "n".repeat(80), kind: "k".repeat(40), summary: "s".repeat(200), notes: "x".repeat(10000) }).ok).toBe(true);
    const r = parseProjectInput({ name: "n".repeat(81), kind: "k".repeat(41), summary: "s".repeat(201), notes: "x".repeat(10001) });
    expect(r).toEqual({
      ok: false,
      problems: [
        "Keep the name to 80 characters or fewer.",
        "Keep the kind to 40 characters or fewer.",
        "Keep the summary to 200 characters or fewer.",
        "Keep the notes to 10,000 characters or fewer.",
      ],
    });
  });

  it("refuses an unknown status", () => {
    expect(parseProjectInput({ name: "Orbit", status: "deleted" })).toEqual({
      ok: false,
      problems: ["Choose active, paused or archived for the status."],
    });
  });

  it("refuses values that are not text", () => {
    expect(parseProjectInput({ name: 5 })).toEqual({ ok: false, problems: ["Give the project a name."] });
    expect(parseProjectInput({ name: "Orbit", summary: 7 })).toEqual({ ok: false, problems: ["The summary must be text."] });
  });
});
