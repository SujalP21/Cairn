module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    // Separate from tsconfig.json so tests are type-aware-lintable without
    // being pulled into the build output.
    project: "./tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    // Must stay last: turns off rules that fight Prettier.
    "prettier",
  ],
  ignorePatterns: ["dist", "node_modules", ".eslintrc.cjs", "vitest.config.ts"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    // Middleware guarantees these are set; the routers document which.
    "@typescript-eslint/no-non-null-assertion": "off",
    "no-console": ["warn", { allow: ["error"] }],
  },
  overrides: [
    {
      files: ["tests/**/*.ts"],
      rules: {
        // supertest types response.body as `any`, so asserting on it trips
        // every unsafe-* rule. The assertions are the point of the file.
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-return": "off",
      },
    },
  ],
};
