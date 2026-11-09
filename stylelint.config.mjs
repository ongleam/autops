const stylelintConfig = {
  ignoreFiles: ["node_modules/**", ".next/**", "out/**", "build/**"],
  rules: {
    // Keep theme tokens and base styles; component styling belongs in Tailwind.
    "selector-class-pattern": ["^$", { message: "Use Tailwind CSS utilities instead of custom CSS classes." }],
    "selector-max-id": 0,
    "at-rule-disallowed-list": ["apply", "utility"],
    "block-no-empty": true,
    "declaration-block-no-duplicate-properties": true,
  },
};

export default stylelintConfig;
