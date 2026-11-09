import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const cssInJsImports = {
  group: ["styled-components", "@emotion/*", "@stitches/*"],
  message: "Use Tailwind CSS utilities instead of CSS-in-JS.",
};
const stylesheetImports = {
  group: ["**/*.css", "**/*.scss", "**/*.sass", "**/*.less"],
  message: "Use Tailwind CSS utilities. Only app/layout.tsx may import globals.css.",
};
const dynamicStylesheets = [
  {
    selector: "ImportExpression[source.value=/\\.(css|scss|sass|less)$/]",
    message: "Use Tailwind CSS utilities instead of dynamically importing stylesheets.",
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.value=/\\.(css|scss|sass|less)$/]",
    message: "Use Tailwind CSS utilities instead of requiring stylesheets.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: { "no-restricted-syntax": ["error", ...dynamicStylesheets] },
  },
  {
    files: ["app/**/*.{js,jsx,ts,tsx}", "components/**/*.{js,jsx,ts,tsx}", "lib/**/*.{js,ts}"],
    rules: {
      // Issues #1/#2: avoid exposing credentials in logs or unsafe HTML.
      "no-console": "error",
      "no-eval": "error",
      "react/no-danger": "error",
      "react/jsx-no-target-blank": "error",
    },
  },
  {
    files: ["app/**/*.{jsx,tsx}", "components/**/*.{jsx,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/globals.css",
        detectComponentClasses: false,
      },
    },
    rules: {
      // Issue #2 requires keyboard access and accessible form controls.
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-concatenated-classes": "error",
      "no-restricted-syntax": [
        "error",
        ...dynamicStylesheets,
        { selector: "JSXAttribute[name.name='style']", message: "Use Tailwind CSS utilities instead of inline styles." },
        { selector: "JSXElement[openingElement.name.name='style']", message: "Use Tailwind CSS utilities instead of style tags." },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [stylesheetImports, cssInJsImports],
      }],
    },
  },
  {
    files: ["app/layout.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/*.css", "!./globals.css", "**/*.scss", "**/*.sass", "**/*.less"], message: "Only the Tailwind entry point ./globals.css is allowed." },
          cssInJsImports,
        ],
      }],
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}", "app/api/**/*.ts"],
    ignores: ["**/*.test.ts"],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // Issue #1: do not silently drop asynchronous server operations.
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["lib/mcp/**/*.ts", "lib/projects/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      // Issue #2: the public MCP must not use local files as persistent storage.
      "no-restricted-imports": ["error", {
        patterns: [
          stylesheetImports,
          cssInJsImports,
          { group: ["fs", "fs/**", "node:fs", "node:fs/**", "bun:sqlite"], message: "The public MCP does not persist user data on the server filesystem." },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
