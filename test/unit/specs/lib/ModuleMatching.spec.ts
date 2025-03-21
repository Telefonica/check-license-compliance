// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { matchesDependencyModule } from "../../../../src/lib/dependencies-reader/Helpers.js";
import type { DependencyInfo } from "../../../../src/lib/DependenciesInfo.types.js";

describe("module matching", () => {
  const createDependency = (
    name: string,
    version?: string,
    resolvedVersion?: string,
  ): DependencyInfo => ({
    id: `NPM:${name}@${version || "1.0.0"}`,
    system: "NPM",
    name,
    version,
    resolvedVersion,
    dependencies: [],
    licenses: [],
    direct: true,
    production: true,
    development: false,
    ancestors: [],
    origins: [],
    errors: [],
    warnings: [],
  });

  describe("string format", () => {
    it("should match when name and version match", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(matchesDependencyModule(dependency, "express@4.17.1")).toBe(true);
    });

    it("should not match when name doesn't match", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(matchesDependencyModule(dependency, "react@16.8.0")).toBe(false);
    });

    it("should not match when version doesn't match", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(matchesDependencyModule(dependency, "express@5.0.0")).toBe(false);
    });
  });

  describe("object format", () => {
    it("should match when name and version match", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          version: "4.17.1",
        }),
      ).toBe(true);
    });

    it("should match when only name is specified", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(matchesDependencyModule(dependency, { name: "express" })).toBe(
        true,
      );
    });

    it("should use resolvedVersion when available", () => {
      const dependency = createDependency("express", "^4.17.0", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          version: "4.17.1",
        }),
      ).toBe(true);
    });
  });

  describe("semver matching", () => {
    it("should match when version satisfies semver expression", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          semver: "^4.17.0",
        }),
      ).toBe(true);
    });

    it("should not match when version doesn't satisfy semver expression", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          semver: "^5.0.0",
        }),
      ).toBe(false);
    });
  });

  describe("regex matching", () => {
    it("should match when name matches regex pattern", () => {
      const dependency = createDependency("@react/core", "17.0.0");

      expect(
        matchesDependencyModule(dependency, { nameMatch: "@react/.*" }),
      ).toBe(true);
    });

    it("should not match when name doesn't match regex pattern", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, { nameMatch: "@react/.*" }),
      ).toBe(false);
    });

    it("should match when version matches regex pattern", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          versionMatch: "4\\.17\\..*",
        }),
      ).toBe(true);
    });

    it("should not match when version doesn't match regex pattern", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          versionMatch: "5\\..*",
        }),
      ).toBe(false);
    });

    it("should match when both name and version match regex patterns", () => {
      const dependency = createDependency("@react/core", "17.0.2");

      expect(
        matchesDependencyModule(dependency, {
          nameMatch: "@react/.*",
          versionMatch: "17\\..*",
        }),
      ).toBe(true);
    });
  });

  describe("complex scenarios", () => {
    it("should prioritize nameMatch over name", () => {
      const dependency = createDependency("@react/core", "17.0.2");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          nameMatch: "@react/.*",
        }),
      ).toBe(true);
    });

    it("should prioritize versionMatch over semver and version", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          version: "5.0.0",
          semver: "^5.0.0",
          versionMatch: "4\\.17\\..*",
        }),
      ).toBe(true);
    });

    it("should prioritize semver over version", () => {
      const dependency = createDependency("express", "4.17.1");

      expect(
        matchesDependencyModule(dependency, {
          name: "express",
          version: "5.0.0",
          semver: "^4.17.0",
        }),
      ).toBe(true);
    });
  });
});
