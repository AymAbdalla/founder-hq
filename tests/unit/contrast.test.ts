import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Plan step 2b: colour contrast is measured in both modes, from the real tokens in
// src/app/globals.css. Thresholds are WCAG 2.2 AA: 4.5:1 for text, 3:1 for controls.

const css = readFileSync("src/app/globals.css", "utf8");

// Returns the declarations inside the first block that starts with `selector`.
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block for ${selector} in globals.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const found: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) found[m[1]] = m[2];
  return found;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const modes: Record<string, Record<string, string>> = {
  light: tokens(":root"),
  "dark (chosen with the switch)": tokens(':root[data-theme="dark"]'),
  "dark (follows the device)": tokens(':root:not([data-theme="light"])'),
};

for (const [mode, t] of Object.entries(modes)) {
  describe(`contrast, ${mode}`, () => {
    const text: [string, string][] = [
      ["text", "ground"], ["text-2", "ground"], ["text-3", "ground"],
      ["text-2", "ground-2"], ["text-3", "ground-2"],
      ["red", "ground"], ["amber", "ground"], ["green", "ground"],
      ["amber", "amber-tint"], ["green-ink", "green"],
      ["rail-text", "rail"], ["rail-text-2", "rail"],
      ["rail-text", "rail-2"], ["rail-text-2", "rail-2"],
    ];
    for (const [fg, bg] of text) {
      it(`${fg} on ${bg} is at least 4.5:1`, () => {
        expect(t[fg], `--${fg}`).toBeDefined();
        expect(t[bg], `--${bg}`).toBeDefined();
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }

    for (const [fg, bg] of [["line-strong", "ground"], ["green", "ground"], ["focus", "ground"]]) {
      it(`${fg} (control border or fill) on ${bg} is at least 3:1`, () => {
        expect(t[fg], `--${fg}`).toBeDefined();
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
      });
    }
  });
}

describe("the dark tokens", () => {
  it("are the same whether chosen with the switch or followed from the device", () => {
    expect(modes["dark (follows the device)"]).toEqual(modes["dark (chosen with the switch)"]);
  });
});
