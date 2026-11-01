import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminForAccount } from "@/lib/supabase/admin";

// Security rule S2 (docs/PLAN.md): the master database key lives in one server-only
// module that requires an account ID.
const ACCOUNT = "3f1c2a9e-8b7d-4e6f-9a01-2b3c4d5e6f70";

describe("adminForAccount", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is tied to the account it was asked for", () => {
    expect(adminForAccount(ACCOUNT).accountId).toBe(ACCOUNT);
  });

  it.each([["", "empty"], ["not-a-uuid", "not an id"], ["*", "a wildcard"]])(
    "refuses to start without a real account id (%s: %s)",
    (bad) => {
      expect(() => adminForAccount(bad)).toThrow(/account id/i);
    },
  );

  it("refuses to start when the key is not configured", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => adminForAccount(ACCOUNT)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
