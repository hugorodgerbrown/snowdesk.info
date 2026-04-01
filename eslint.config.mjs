import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["**/node_modules/", "**/.next/", "**/generated/", "**/*.d.ts"],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Next.js rules for web workspace
  {
    files: ["web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    settings: {
      next: { rootDir: "web" },
    },
  },

  // Next.js rules for poller workspace
  {
    files: ["poller/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    settings: {
      next: { rootDir: "poller" },
    },
  },

  // Project-wide TypeScript overrides
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Keep it practical — warn on unused vars but allow underscore prefix
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any in rare cases (warn, not error)
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
);
