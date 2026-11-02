import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { latestEmailTo, testEmail } from "../support/mail";
import { signInNewAccount } from "../support/session";

// Check 3: a new account contains nothing about the first user: no "aym", "~/aym",
// "morrow", "founder-hq" or their repo names, on any screen, placeholder or default.
// Check 12: the account has no payment screen anywhere.
//
// Repo names are read from the local reference copy at run time, so they are never
// written into this test. Without that file, only the fixed terms are checked.
const SEED = "reference/data/seed-projects-2026-10-11.json";

function personalTerms(): string[] {
  const terms = ["aym", "~/aym", "morrow", "founder-hq", "aymabdalla"];
  if (existsSync(SEED)) {
    const projects = JSON.parse(readFileSync(SEED, "utf8")) as Record<string, { repo?: string }>;
    for (const [id, p] of Object.entries(projects)) {
      terms.push(id);
      if (p.repo) terms.push(p.repo.split("/").pop()!);
    }
  }
  return [...new Set(terms.map((t) => t.toLowerCase()))];
}

const PAYMENT_WORDS = /\b(payment|payments|billing|pricing|price|subscribe|subscription|upgrade|checkout|credit card|invoice)\b/i;

function findTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return personalTerms().filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Whole words only, so "tomorrow" never counts as "morrow".
    return new RegExp(`(^|[^a-z0-9-])${escaped}($|[^a-z0-9-])`).test(lower);
  });
}

async function everythingShown(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = [document.title, document.body.innerText];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      for (const attr of ["placeholder", "title", "aria-label", "alt", "content"]) {
        const v = el.getAttribute(attr);
        if (v) parts.push(v);
      }
      if (el instanceof HTMLInputElement && el.type !== "hidden" && el.value) parts.push(el.value);
    }
    return parts.join("\n");
  });
}

test("no screen, placeholder, default or email mentions the first user, and none asks for payment", async ({ page }) => {
  const seen: Record<string, string> = {};

  await page.goto("/sign-in");
  seen["sign-in"] = await everythingShown(page);

  const email = testEmail("personal");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();
  seen["code step"] = (await everythingShown(page)).replaceAll(email, "");
  const mail = await latestEmailTo(email);
  seen["sign-in email"] = `${mail.text}\n${mail.html}`;

  await page.goto("/auth/confirm?token_hash=x&type=email");
  seen["confirm link page"] = await everythingShown(page);

  await signInNewAccount(page, "personal-signed-in");
  seen["first-run"] = await everythingShown(page);

  for (const [screen, text] of Object.entries(seen)) {
    expect(findTerms(text), `personal terms on ${screen}`).toEqual([]);
    expect(text.match(PAYMENT_WORDS)?.[0] ?? null, `payment wording on ${screen}`).toBeNull();
  }
});

test("there is no payment page at any usual address", async ({ request }) => {
  for (const path of ["/billing", "/pricing", "/checkout", "/upgrade", "/subscribe", "/payment"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
