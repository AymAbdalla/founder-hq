import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { sqlText } from "../support/db";

// Security rule S5, independent check finding F1: two sign-in requests for the same address
// at the same moment must not both pass a limit. The first request keeps its transaction open
// (pg_sleep) while the second one asks; the second must wait for it and then be refused.
const run = promisify(execFile);
async function rows(query: string): Promise<Record<string, unknown>[]> {
  const { stdout } = await run("npx", ["supabase", "db", "query", "--local", query]);
  return JSON.parse(stdout).rows;
}
const ask = (kind: string, email: string) => `public.allow_sign_in_event(${sqlText(kind)}, ${sqlText(email)})`;
const held = (kind: string, email: string) =>
  `with checked as materialized (select ${ask(kind, email)} as answer)
   select answer from checked cross join lateral (select pg_sleep(3) where checked.answer = 'ok') pause`;
const stored = async (kind: string, email: string) =>
  Number(
    (
      await rows(
        `select count(*) as n from private.sign_in_events where kind = ${sqlText(kind)} and subject = encode(extensions.digest(${sqlText(email)}, 'sha256'), 'hex')`,
      )
    )[0].n,
  );

async function overlap(kind: string, email: string) {
  const first = rows(held(kind, email));
  await new Promise((r) => setTimeout(r, 1000));
  const second = await rows(`select ${ask(kind, email)} as answer`);
  return { first: (await first)[0].answer, second: second[0].answer };
}

describe("sign-in limits under overlapping requests", () => {
  it("lets only one of two overlapping sign-in emails through in a minute", async () => {
    const email = `race-email-${Date.now()}@example.test`;
    const answers = await overlap("email_sent", email);
    expect(answers).toEqual({ first: "ok", second: "wait_minute" });
    expect(await stored("email_sent", email)).toBe(1);
  }, 30_000);

  it("never accepts a sixth code try, even when the fifth and sixth overlap", async () => {
    const email = `race-code-${Date.now()}@example.test`;
    await rows(`select ${ask("code_attempt", email)} from generate_series(1, 4)`);
    const answers = await overlap("code_attempt", email);
    expect(answers).toEqual({ first: "ok", second: "wait_attempts" });
    expect(await stored("code_attempt", email)).toBe(5);
  }, 30_000);
});
