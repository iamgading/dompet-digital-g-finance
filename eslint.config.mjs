import js from "@eslint/js";
import pluginNext from "@next/eslint-plugin-next";
import parserTypeScript from "@typescript-eslint/parser";
import pluginImport from "eslint-plugin-import";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: parserTypeScript,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2022,
        sourceType: "module",
        projectService: true,
      },
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
    },
    plugins: {
      "@next/next": pluginNext,
      import: pluginImport,
      "jsx-a11y": pluginJsxA11y,
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs["jsx-runtime"].rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginImport.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,
    },
    settings: {
      react: {
        version: "detect",
      },
      next: {
        rootDir: ["./"],
      },
    },
  },
];
