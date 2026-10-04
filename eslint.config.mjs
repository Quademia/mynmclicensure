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
    // The archive: the old product and the old plan docs, kept as the
    // reference. Never linted: it is read, not maintained (AGENTS.md).
    "archive/**",
    // Assistant tooling, not application code.
    ".claude/**",
  ]),
]);

export default eslintConfig;
