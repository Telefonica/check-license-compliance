// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: MIT

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/index.ts",
    "!src/action/Process.ts",
    "!src/lib/Paths.ts",
    "!src/lib/proto/**",
  ],

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // An object that configures minimum threshold enforcement for coverage results
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },

  setupFiles: ["./test/unit/setup.ts"],

  // The glob patterns Jest uses to detect test files
  testMatch: ["<rootDir>/test/unit/specs/**/*.spec.ts"],

  transform: {
    "^.+.ts$": [
      "ts-jest",
      {
        tsconfig: "test/tsconfig.json",
      },
    ],
  },

  moduleNameMapper: {
    "^(.*)\\.js$": "$1",
  },
};
