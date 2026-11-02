import { describe, expect, it } from "vitest";
import { anonymousClient, newSignedInAccount } from "../support/accounts";

// Security rule S5: only HQ's own server may record or check sign-in limits.
// If the public could call the limit function, anyone could use up another
// address's sign-in emails directly, without going through HQ's sign-in form.
describe("sign-in limit function", () => {
  it("cannot be called by someone who is not signed in", async () => {
    const { data, error } = await anonymousClient().rpc("allow_sign_in_event", {
      p_kind: "email_sent",
      p_email: "someone-else@example.test",
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501"); // Postgres: permission denied
  });

  it("cannot be called by a signed-in account either", async () => {
    const account = await newSignedInAccount("limit-access");
    const { data, error } = await account.db.rpc("allow_sign_in_event", {
      p_kind: "email_sent",
      p_email: "someone-else@example.test",
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });
});
