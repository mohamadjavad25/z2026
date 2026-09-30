import js from "@eslint/js";
import n from "eslint-plugin-n";
import globals from "globals";

/**
 * Minimal flat config -- eslint:recommended + eslint-plugin-n (Node-
 * specific rules, useful since this is server-side code), not a heavy
 * opinionated preset, to keep the initial adoption diff small.
 *
 * Scoped to the backend surface this rewrite actually touched (app/api,
 * app/lib, migrations tooling, scripts, tests, config files) -- not
 * app/features/**\/app/components/**\ (the pre-existing React/JSX
 * frontend), which is out of scope for a backend/database-focused
 * rewrite and would otherwise surface an unrelated pile of findings this
 * pass never reviewed. Extend the `files` list here if/when the frontend
 * gets its own lint pass.
 */
export default [
  {
    ignores: ["node_modules/**", ".next/**", "app/features/**", "app/components/**", "app/**/*.jsx", "public/**"]
  },
  {
    files: ["app/api/**/*.js", "app/lib/**/*.js", "scripts/**/*.js", "scripts/**/*.mjs", "tests/**/*.js", "*.config.js", "*.mjs"],
    plugins: { n },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      ...js.configs.recommended.rules,
      "n/no-missing-import": "error",
      "n/no-unsupported-features/es-syntax": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  }
];
