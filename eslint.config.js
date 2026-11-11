import js from "@eslint/js";
import n from "eslint-plugin-n";
import globals from "globals";

/**
 * Two passes:
 *
 * 1. The server side (app/api, app/lib, scripts, tests, config files): eslint:recommended + eslint-plugin-n.
 * 2. The React side (everything else under app/): only the rules that catch code that cannot run, above all a name
 *    that does not exist (`no-undef`). A hook or component split that forgets an import or a value is the one mistake
 *    no test catches until someone opens that screen, so it is refused here (added 2026-11-11 with the split of the
 *    large hooks). Style and unused names are not judged on this side.
 *
 * The React files carry `eslint-disable` comments for rules of two plugins that are not installed
 * (react-hooks, @next/next); the stand-ins below only make those names known, they check nothing.
 */
const knownRules = (names) => ({ rules: Object.fromEntries(names.map((name) => [name, { create: () => ({}) }])) });

export default [
  {
    ignores: ["node_modules/**", ".next/**", "public/**", "mobile/**", "graphify-out/**"]
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
  },
  {
    files: ["app/**/*.js", "app/**/*.jsx"],
    ignores: ["app/api/**", "app/lib/**"],
    plugins: {
      "react-hooks": knownRules(["exhaustive-deps", "rules-of-hooks"]),
      "@next/next": knownRules(["no-img-element"])
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node }
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "no-undef": "error",
      "no-const-assign": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-redeclare": "error",
      "no-unreachable": "error"
    }
  }
];
