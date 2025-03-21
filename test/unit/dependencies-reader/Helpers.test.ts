// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import type { ModuleSpec } from "../../../src/lib/dependencies-reader/DependenciesReader.types.js";
import { matchesDependencyModule } from "../../../src/lib/dependencies-reader/Helpers.js";
import type { DependencyInfo } from "../../../src/lib/DependenciesInfo.types.js";

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

    const moduleSpecWithVersion: ModuleSpec = "express@4.17.1";

    expect(
      matchesDependencyModule(dependencyWithoutVersion, moduleSpecWithVersion),
    ).toBe(false);
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
});
