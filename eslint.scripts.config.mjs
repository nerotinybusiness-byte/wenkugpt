import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

const scriptsEslintConfig = defineConfig([
  ...nextTs,
  {
    files: ["scripts/**/*.{ts,js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-console": "off",
    },
  },
  globalIgnores([
    "scripts/**/*.log",
    "scripts/**/*.txt",
    "scripts/**/*.html",
    "scripts/**/*.json",
  ]),
]);

export default scriptsEslintConfig;
