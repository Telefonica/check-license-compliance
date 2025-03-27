// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import type { ModuleSpec } from "../../../../../src/lib/dependencies-reader/DependenciesReader.types.js";
import {
  getDependencyName,
  matchesDependencyModule,
} from "../../../../../src/lib/dependencies-reader/Helpers.js";
import type { DependencyInfo } from "../../../../../src/lib/DependenciesInfo.types.js";

describe("matchesDependencyModule", () => {
  const dependency: DependencyInfo = {
    id: "NPM:express@4.17.1",
    system: "NPM",
    name: "express",
    version: "4.17.1",
    resolvedVersion: "4.17.1",
    dependencies: [],
    licenses: ["MIT"],
    direct: true,
    production: true,
    development: false,
    ancestors: [],
    origins: ["package.json"],
    errors: [],
    warnings: [],
  };

  it("should match a dependency with a simple string moduleSpec", () => {
    const moduleSpec: ModuleSpec = "express@4.17.1";

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should match a dependency with a simple string moduleSpec without version", () => {
    const moduleSpec: ModuleSpec = "express";

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should not match a dependency with a different name", () => {
    const moduleSpec: ModuleSpec = "react@17.0.2";

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(false);
  });

  it("should not match a dependency with a different version", () => {
    const moduleSpec: ModuleSpec = "express@4.18.0";

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(false);
  });

  it("should match a dependency with an object moduleSpec with name", () => {
    const moduleSpec: ModuleSpec = { name: "express" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should match a dependency with an object moduleSpec with name and version", () => {
    const moduleSpec: ModuleSpec = { name: "express", version: "4.17.1" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should not match a dependency with a different version in object moduleSpec", () => {
    const moduleSpec: ModuleSpec = { name: "express", version: "4.18.0" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(false);
  });

  it("should match a dependency with a semver expression", () => {
    const moduleSpec: ModuleSpec = { name: "express", semver: "^4.17.0" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should not match a dependency with a semver expression that doesn't match", () => {
    const moduleSpec: ModuleSpec = { name: "express", semver: "^5.0.0" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(false);
  });

  it("should match a dependency with a nameMatch regex", () => {
    const moduleSpec: ModuleSpec = { nameMatch: "^exp.*" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should not match a dependency with a nameMatch regex that doesn't match", () => {
    const moduleSpec: ModuleSpec = { nameMatch: "^react.*" };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(false);
  });

  it("should match a dependency with a versionMatch regex", () => {
    const moduleSpec: ModuleSpec = {
      name: "express",
      versionMatch: "^4\\.17.*",
    };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should not match a dependency with a versionMatch regex that doesn't match", () => {
    const moduleSpec: ModuleSpec = {
      name: "express",
      versionMatch: "^4\\.18.*",
    };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(false);
  });

  it("should correctly handle dependencies without version", () => {
    const dependencyWithoutVersion: DependencyInfo = {
      ...dependency,
      version: undefined,
      resolvedVersion: undefined,
    };

    const moduleSpec: ModuleSpec = "express";

    expect(matchesDependencyModule(dependencyWithoutVersion, moduleSpec)).toBe(
      true,
    );
  });

  it("should prioritize nameMatch over name", () => {
    const moduleSpec: ModuleSpec = {
      name: "react",
      nameMatch: "^exp.*",
    };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should prioritize versionMatch over version and semver", () => {
    const moduleSpec: ModuleSpec = {
      name: "express",
      version: "4.18.0",
      semver: "^5.0.0",
      versionMatch: "^4\\.17.*",
    };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should prioritize semver over version", () => {
    const moduleSpec: ModuleSpec = {
      name: "express",
      version: "4.18.0",
      semver: "^4.17.0",
    };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should handle invalid semver versions gracefully", () => {
    const dependencyWithInvalidVersion: DependencyInfo = {
      ...dependency,
      version: "invalid-semver",
      resolvedVersion: "invalid-semver",
    };

    const moduleSpec: ModuleSpec = {
      name: "express",
      semver: "^4.17.0",
    };

    expect(
      matchesDependencyModule(dependencyWithInvalidVersion, moduleSpec),
    ).toBe(false);
  });

  it("should handle complex object specs with multiple criteria", () => {
    const moduleSpec: ModuleSpec = {
      nameMatch: "^exp.*",
      versionMatch: "^4\\..*",
    };

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });

  it("should correctly handle string moduleSpec with system id", () => {
    const moduleSpec: ModuleSpec = "NPM:express@4.17.1";

    expect(matchesDependencyModule(dependency, moduleSpec)).toBe(true);
  });
});

describe("getDependencyName", () => {
  it("should return a string with system and name for NPM package", () => {
    const dependency = {
      system: "NPM",
      name: "express",
    } as DependencyInfo;

    expect(getDependencyName(dependency)).toBe("NPM:express");
  });

  it("should return a string with system and name for Maven package", () => {
    const dependency = {
      system: "MAVEN",
      name: "org.apache.commons:commons-lang3",
    } as DependencyInfo;

    expect(getDependencyName(dependency)).toBe(
      "MAVEN:org.apache.commons:commons-lang3",
    );
  });

  it("should return a string with system and name for Python package", () => {
    const dependency = {
      system: "PYPI",
      name: "requests",
    } as DependencyInfo;

    expect(getDependencyName(dependency)).toBe("PYPI:requests");
  });

  it("should return a string with system and name for Go package", () => {
    const dependency = {
      system: "GO",
      name: "github.com/foo/testify",
    } as DependencyInfo;

    expect(getDependencyName(dependency)).toBe("GO:github.com/foo/testify");
  });

  it("should handle dependency with special characters in name", () => {
    const dependency = {
      system: "NPM",
      name: "@types/node",
    } as DependencyInfo;

    expect(getDependencyName(dependency)).toBe("NPM:@types/node");
  });
});
