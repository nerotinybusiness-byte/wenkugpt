import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Phase 3 gate: keep lint non-blocking while we finish type cleanup in Phase 4.
  {
    files: ["src/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".vercel/**",
    "coverage/**",
    // Generated/minified assets and backups:
    "public/pdf.worker.min.mjs",
    "**/*.min.js",
    "**/*.min.mjs",
    "**/*.backup.*",
    // Local helper artifacts:
    "scripts/**/*.log",
    "scripts/**/*.txt",
    "scripts/**/*.html",
    "scripts/**/*.json",
  ]),
]);

export default eslintConfig;
