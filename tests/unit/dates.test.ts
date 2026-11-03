import { describe, expect, it } from "vitest";
import { addDays, isDateString, isTimeString, isTimeZone, todayIn } from "@/lib/dates";

describe("todayIn", () => {
  const now = new Date("2026-11-02T03:30:00Z");
  it("gives the calendar date in each zone", () => {
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-11-01");
    expect(todayIn("Europe/Berlin", now)).toBe("2026-11-02");
    expect(todayIn("UTC", now)).toBe("2026-11-02");
  });
  it("falls back to UTC for a bad zone", () => {
    expect(todayIn("Not/AZone", now)).toBe("2026-11-02");
  });
});

describe("isTimeZone", () => {
  it("accepts real zones and refuses everything else", () => {
    expect(isTimeZone("Europe/Berlin")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Nope/Nowhere")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone(5)).toBe(false);
    expect(isTimeZone("A".repeat(65))).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-02", 7)).toBe("2026-11-09");
    expect(addDays("2026-11-02", 0)).toBe("2026-11-02");
  });
});

describe("isDateString", () => {
  it("accepts real dates only", () => {
    expect(isDateString("2026-11-02")).toBe(true);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2026-1-2")).toBe(false);
    expect(isDateString("02/11/2026")).toBe(false);
    expect(isDateString(" 2026-11-02")).toBe(false);
    expect(isDateString(null)).toBe(false);
  });
});

describe("isTimeString", () => {
  it("accepts HH:MM and HH:MM:SS", () => {
    expect(isTimeString("00:00")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("09:05:00")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("12:60")).toBe(false);
    expect(isTimeString("9:5")).toBe(false);
    expect(isTimeString("09:05:61")).toBe(false);
    expect(isTimeString("")).toBe(false);
    expect(isTimeString(900)).toBe(false);
  });
});
