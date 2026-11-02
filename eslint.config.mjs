import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The one file allowed to hold the master database key (security rule S2).
const ADMIN_MODULE = "src/lib/supabase/admin.ts";

// S3: text from repos and AI tools must never run as code, so raw HTML is banned.
const noRawHtml = [
  {
    selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]",
    message: "Raw HTML is banned (security rule S3). Render text with React instead.",
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: "Raw HTML is banned (security rule S3). Render text with React instead.",
  },
  {
    selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
    message: "document.write is banned (security rule S3).",
  },
];

// S2: only the admin module may read the master key.
// Catches both process.env.SUPABASE_SERVICE_ROLE_KEY and process.env["SUPABASE_SERVICE_ROLE_KEY"].
const noMasterKey = {
  selector:
    "MemberExpression[property.name='SUPABASE_SERVICE_ROLE_KEY'], MemberExpression[property.value='SUPABASE_SERVICE_ROLE_KEY']",
  message: `The master database key may only be read in ${ADMIN_MODULE} (security rule S2).`,
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react/no-danger": "error",
      "no-restricted-syntax": ["error", ...noRawHtml, noMasterKey],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message: "Create Supabase clients only in src/lib/supabase/ (security rule S2).",
            },
          ],
        },
      ],
    },
  },
  {
    // Supabase client factories live here; they may import createClient.
    files: ["src/lib/supabase/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Tests never ship; they may create their own clients to act as test accounts.
    files: ["tests/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // The admin module is the only place allowed to read the master key.
    // Its own unit test may set a fake value.
    files: [ADMIN_MODULE, "tests/unit/admin-client.test.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...noRawHtml],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "reference/**", "test-results/**", "playwright-report/**"]),
]);
