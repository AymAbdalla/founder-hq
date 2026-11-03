import { describe, expect, it } from "vitest";
import { githubEnabledFrom } from "@/lib/supabase/providers";

// Supabase's /auth/v1/settings answer decides whether "Continue with GitHub" is shown.
describe("reading whether GitHub sign-in is on", () => {
  it("is on only when Supabase says github: true", () => {
    expect(githubEnabledFrom({ external: { github: true, email: true } })).toBe(true);
    expect(githubEnabledFrom({ external: { github: false, email: true } })).toBe(false);
    expect(githubEnabledFrom({ external: { email: true } })).toBe(false);
  });

  it("counts an answer it can't read as on, so a hiccup never hides a working sign-in", () => {
    expect(githubEnabledFrom(null)).toBe(true);
    expect(githubEnabledFrom("nonsense")).toBe(true);
    expect(githubEnabledFrom({})).toBe(true);
  });
});
