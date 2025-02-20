// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: MIT

import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
// eslint-disable-next-line import/no-unresolved
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
// eslint-disable-next-line import/no-unresolved
import typescriptParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import pluginJest from "eslint-plugin-jest";
import prettier from "eslint-plugin-prettier";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".husky/**",
      "package-lock.json",
      "dist/**",
      "submodules/**",
      "src/lib/proto/**/*.ts",
    ],
  },
  {
    files: ["**/*.json"],
    language: "json/json",
    plugins: {
      json,
    },
    rules: {
      "json/no-duplicate-keys": "error",
      "json/no-empty-keys": "error",
    },
  },
  {
    files: ["**/*.jsonc"],
    language: "json/jsonc",
    plugins: {
      json,
    },
    rules: {
      "json/no-duplicate-keys": "error",
      "json/no-empty-keys": "error",
    },
  },
  {
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    language: "markdown/commonmark",
    rules: {
      "markdown/no-html": [0],
    },
  },
  {
    files: [
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/*.jsx",
      "**/*.ts",
      "**/*.tsx",
    ],
    plugins: {
      prettier,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...importPlugin.flatConfigs.recommended.rules,
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      ...eslintPluginPrettierRecommended.rules,
      camelcase: [2, { properties: "never" }],
      "no-console": [2, { allow: ["warn", "error"] }],
      "no-shadow": [2, { builtinGlobals: true, hoist: "all" }],
      "no-undef": [2],
      "no-unused-vars": [
        2,
        { vars: "all", args: "after-used", ignoreRestSiblings: false },
      ],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
    },
    rules: {
      ...typescriptEslintPlugin.configs.recommended.rules,
      "import/extensions": [
        "error",
        "always",
        {
          js: "always",
          ts: "never",
          tsx: "never",
          json: "always",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false,
        },
      ],
    },
    settings: {
      "import/resolver": {
        typescript: {
          extensions: [".js"],
          alwaysTryTypes: true,
          project: ["./tsconfig.json"],
        },
        node: {
          extensions: [".js", ".ts", ".tsx", ".json"],
        },
      },
    },
  },
  {
    files: ["test/**/*.ts"],
    plugins: {
      jest: pluginJest,
    },
    ...pluginJest.configs["flat/recommended"],
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
    },
    settings: {
      "import/resolver": {
        typescript: {
          extensions: [".ts", ".tsx"],
          alwaysTryTypes: true,
          project: ["./test/tsconfig.json"],
        },
        node: true,
      },
    },
    rules: {
      ...pluginJest.configs["flat/all"].rules,
      "jest/no-disabled-tests": "error",
      "jest/no-focused-tests": "error",
      "jest/no-identical-title": "error",
      "jest/prefer-to-have-length": "error",
      "jest/valid-expect": "error",
      "jest/prefer-strict-equal": [0],
      "jest/prefer-importing-jest-globals": [0],
      "jest/prefer-expect-assertions": [0],
      "jest/no-hooks": [0],
      "jest/prefer-called-with": [0],
      "jest/require-to-throw-message": [0],
    },
  },
];
