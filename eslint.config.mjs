import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".open-next/**",
    // The old product, kept verbatim as the reference until cutover.
    // Never linted: it is read, not maintained (AGENTS.md rule #8).
    "legacy/**",
    // Assistant tooling, not application code.
    ".claude/**",
  ]),
]);

export default eslintConfig;
