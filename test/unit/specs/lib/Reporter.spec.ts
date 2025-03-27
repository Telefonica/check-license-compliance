// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable jest/max-expects */

import type { Result } from "../../../../src/lib/Checker.types";
import { getReport, ALL_VALID } from "../../../../src/lib/Reporter";

describe("reporter", () => {
  const emptyResult: Result = {
    forbidden: [],
    warning: [],
    allowed: [],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const successResult: Result = {
    forbidden: [],
    warning: [],
    allowed: [
      {
        module: "test-module",
        licenses: ["MIT"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
      {
        module: "another-module",
        version: "1.0.0",
        resolvedVersion: "1.0.0",
        licenses: ["Apache-2.0"],
        direct: false,
        origins: ["package.json"],
        ancestors: ["parent-module"],
      },
    ],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const warningResult: Result = {
    forbidden: [],
    warning: [
      {
        module: "warning-module",
        licenses: ["LGPL-3.0"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    allowed: [],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const forbiddenResult: Result = {
    forbidden: [
      {
        module: "forbidden-module",
        licenses: ["GPL-3.0"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    warning: [],
    allowed: [],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const mixedResult: Result = {
    forbidden: [
      {
        module: "forbidden-module",
        licenses: ["GPL-3.0"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    warning: [
      {
        module: "warning-module",
        licenses: ["LGPL-3.0"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    allowed: [
      {
        module: "allowed-module",
        licenses: ["MIT"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    caveats: {
      errors: [new Error("Test error")],
      warnings: ["Test warning"],
    },
  };

  const singleAllowedResult: Result = {
    forbidden: [],
    warning: [],
    allowed: [
      {
        module: "single-module",
        licenses: ["MIT"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const multipleWarningResult: Result = {
    forbidden: [],
    warning: [
      {
        module: "warning-module-1",
        licenses: ["LGPL-3.0"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
      {
        module: "warning-module-2",
        licenses: ["LGPL-2.1"],
        direct: false,
        origins: ["package.json"],
        ancestors: ["parent-module"],
      },
    ],
    allowed: [],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const multipleForbiddenResult: Result = {
    forbidden: [
      {
        module: "forbidden-module-1",
        licenses: ["GPL-3.0"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
      {
        module: "forbidden-module-2",
        licenses: ["GPL-2.0"],
        direct: false,
        origins: [],
        ancestors: ["parent-module"],
      },
    ],
    warning: [],
    allowed: [],
    caveats: {
      errors: [],
      warnings: [],
    },
  };

  const onlyCaveatsResult: Result = {
    forbidden: [],
    warning: [],
    allowed: [
      {
        module: "test-module",
        licenses: ["MIT"],
        direct: true,
        origins: ["package.json"],
        ancestors: [],
      },
    ],
    caveats: {
      errors: [new Error("Test error 1"), new Error("Test error 2")],
      warnings: ["Test warning 1", "Test warning 2"],
    },
  };

  describe("getReport", () => {
    describe("text reporter", () => {
      it("should return empty report when no dependencies are found", () => {
        const report = getReport("text", emptyResult, true);

        expect(report).toBe("No dependencies found");
      });

      it("should return success report with number of allowed dependencies", () => {
        const report = getReport("text", successResult, true);

        expect(report).toContain(
          "There are 2 dependencies with allowed licenses.",
        );
      });

      it("should return error report with warning dependencies", () => {
        const report = getReport("text", warningResult, false);

        expect(report).toContain("Result: Not valid licenses");
        expect(report).toContain(
          "There is 1 dependency with dangerous licenses:",
        );
        expect(report).toContain("warning-module");
        expect(report).toContain("LGPL-3.0");
      });

      it("should return error report with forbidden dependencies", () => {
        const report = getReport("text", forbiddenResult, false);

        expect(report).toContain("Result: Not valid licenses");
        expect(report).toContain(
          "There is 1 dependency with forbidden licenses:",
        );
        expect(report).toContain("forbidden-module");
        expect(report).toContain("GPL-3.0");
      });

      it("should return error report with mixed dependencies and caveats", () => {
        const report = getReport("text", mixedResult, false);

        expect(report).toContain("Result: Not valid licenses");
        expect(report).toContain("warning-module");
        expect(report).toContain("forbidden-module");
        expect(report).toContain("Test error");
        expect(report).toContain("Test warning");
      });

      it("should return success report with a single allowed dependency", () => {
        const report = getReport("text", singleAllowedResult, true);

        expect(report).toContain(
          "There is 1 dependency with allowed licenses.",
        );
      });

      it("should return error report with multiple warning dependencies", () => {
        const report = getReport("text", multipleWarningResult, false);

        expect(report).toContain("Result: Not valid licenses");
        expect(report).toContain(
          "There are 2 dependencies with dangerous licenses:",
        );
        expect(report).toContain("warning-module-1");
        expect(report).toContain("warning-module-2");
        expect(report).toContain("LGPL-3.0");
        expect(report).toContain("LGPL-2.1");
      });

      it("should handle undefined origins in dependencies", () => {
        const report = getReport("text", multipleForbiddenResult, false);

        expect(report).toContain(
          "Not able to determine the file where it is defined",
        );
      });

      it("should display caveats when there are no errors no warnings", () => {
        const report = getReport("text", onlyCaveatsResult, false);

        expect(report).toContain("Test error 1");
        expect(report).toContain("Test error 2");
        expect(report).toContain("Test warning 1");
        expect(report).toContain("Test warning 2");
      });

      it("should return valid result with warning dependencies when isValid is true", () => {
        const report = getReport("text", warningResult, true);

        expect(report).toContain("Result: Valid licenses");
      });
    });

    describe("markdown reporter", () => {
      it("should return empty report when no dependencies are found", () => {
        const report = getReport("markdown", emptyResult, true);

        expect(report).toContain("__Check License Compliance__");
        expect(report).toContain("✅ No dependencies found");
      });

      it("should return success report with number of allowed dependencies", () => {
        const report = getReport("markdown", successResult, true);

        expect(report).toContain("__Check License Compliance__");
        expect(report).toContain(
          "✅ There are 2 dependencies with allowed licenses.",
        );
      });

      it("should return error report with warning dependencies", () => {
        const report = getReport("markdown", warningResult, false);

        expect(report).toContain("__Check License Compliance__");
        expect(report).toContain(
          "⚠️ There is 1 dependency with dangerous licenses:",
        );
        expect(report).toContain("__warning-module__");
        expect(report).toContain("LGPL-3.0");
        expect(report).toContain("❌ Result: Not valid licenses");
      });

      it("should return error report with forbidden dependencies", () => {
        const report = getReport("markdown", forbiddenResult, false);

        expect(report).toContain("__Check License Compliance__");
        expect(report).toContain(
          "❌ There is 1 dependency with forbidden licenses:",
        );
        expect(report).toContain("__forbidden-module__");
        expect(report).toContain("GPL-3.0");
        expect(report).toContain("❌ Result: Not valid licenses");
      });

      it("should return valid report with warning dependencies when isValid is true", () => {
        const report = getReport("markdown", warningResult, true);

        expect(report).toContain("✅ Result: Valid licenses");
      });

      it("should return error report with mixed dependencies and caveats", () => {
        const report = getReport("markdown", mixedResult, false);

        expect(report).toContain("__Check License Compliance__");
        expect(report).toContain(
          "✅ There is 1 dependency with allowed licenses.",
        );
        expect(report).toContain(
          "⚠️ There is 1 dependency with dangerous licenses:",
        );
        expect(report).toContain(
          "❌ There is 1 dependency with forbidden licenses:",
        );
        expect(report).toContain(
          "‼️ There were some issues while verifying the licenses.",
        );
        expect(report).toContain("* __Test error__");
        expect(report).toContain("* __Test warning__");
        expect(report).toContain("❌ Result: Not valid licenses");
      });

      it("should handle only caveats in markdown format", () => {
        const report = getReport("markdown", onlyCaveatsResult, true);

        expect(report).toContain(
          "‼️ There were some issues while verifying the licenses.",
        );
        expect(report).toContain("* __Test error 1__");
        expect(report).toContain("* __Test error 2__");
        expect(report).toContain("* __Test warning 1__");
        expect(report).toContain("* __Test warning 2__");
      });
    });

    describe("json reporter", () => {
      it("should return empty report when no dependencies are found", () => {
        const report = getReport("json", emptyResult, true);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.message).toBe("No dependencies found");
        expect(jsonReport.allowed).toEqual([]);
        expect(jsonReport.forbidden).toEqual([]);
        expect(jsonReport.warning).toEqual([]);
      });

      it("should return success report with number of allowed dependencies", () => {
        const report = getReport("json", successResult, true);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.allowed).toHaveLength(2);
      });

      it("should return error report with warning dependencies", () => {
        const report = getReport("json", warningResult, false);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.message).toContain(
          "Found 0 allowed, 0 forbidden and 1 dangerous dependencies",
        );
        expect(jsonReport.warning).toHaveLength(1);
        expect(jsonReport.warning[0].module).toBe("warning-module");
        expect(jsonReport.warning[0].licenses).toEqual(["LGPL-3.0"]);
      });

      it("should return error report with forbidden dependencies", () => {
        const report = getReport("json", forbiddenResult, false);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.message).toContain(
          "Found 0 allowed, 1 forbidden and 0 dangerous dependencies",
        );
        expect(jsonReport.forbidden).toHaveLength(1);
        expect(jsonReport.forbidden[0].module).toBe("forbidden-module");
        expect(jsonReport.forbidden[0].licenses).toEqual(["GPL-3.0"]);
      });

      it("should return error report with mixed dependencies and caveats", () => {
        const report = getReport("json", mixedResult, false);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.message).toContain(
          "Found 1 allowed, 1 forbidden and 1 dangerous dependencies",
        );
        expect(jsonReport.allowed).toHaveLength(1);
        expect(jsonReport.warning).toHaveLength(1);
        expect(jsonReport.forbidden).toHaveLength(1);
        expect(jsonReport.caveats.errors).toHaveLength(1);
        expect(jsonReport.caveats.warnings).toHaveLength(1);
      });

      it("should preserve all result properties in json format", () => {
        const report = getReport("json", multipleForbiddenResult, false);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.forbidden[0].module).toBe("forbidden-module-1");
        expect(jsonReport.forbidden[0].licenses).toEqual(["GPL-3.0"]);
        expect(jsonReport.forbidden[0].direct).toBe(true);
        expect(jsonReport.forbidden[1].ancestors).toEqual(["parent-module"]);
      });

      it("should include caveats in json format", () => {
        const report = getReport("json", onlyCaveatsResult, false);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.caveats.errors).toHaveLength(2);
        expect(jsonReport.caveats.warnings).toEqual([
          "Test warning 1",
          "Test warning 2",
        ]);
      });

      it("should handle newlines in json message", () => {
        const result: Result = {
          ...successResult,
          caveats: {
            errors: [new Error("Error\nwith\nnewlines")],
            warnings: ["Warning\nwith\nnewlines"],
          },
        };
        const report = getReport("json", result, true);
        const jsonReport = JSON.parse(report);

        expect(jsonReport.message).not.toContain("\n");
      });
    });

    describe("constants", () => {
      it("should export ALL_VALID constant", () => {
        expect(ALL_VALID).toBe("All dependencies have acceptable licenses.");
      });
    });
  });
});
