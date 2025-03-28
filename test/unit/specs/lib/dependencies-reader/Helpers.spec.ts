// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable jest/max-expects */

import type { ModuleSpec } from "../../../../../src/lib/dependencies-reader/DependenciesReader.types.js";
import {
  getDependencyName,
  isValidVersion,
  matchesDependencyModule,
  resolveVersion,
  NPM_SYSTEM,
  MAVEN_SYSTEM,
  PYTHON_SYSTEM,
  GO_SYSTEM,
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

describe("isValidVersion", () => {
  // NPM System - uses semver validation
  describe("npm system versions", () => {
    it("should validate valid NPM semver versions", () => {
      expect(isValidVersion(NPM_SYSTEM, "1.0.0")).toBe(true);
      expect(isValidVersion(NPM_SYSTEM, "1.2.3")).toBe(true);
      expect(isValidVersion(NPM_SYSTEM, "0.1.0")).toBe(true);
      expect(isValidVersion(NPM_SYSTEM, "2.0.0-alpha")).toBe(true);
      expect(isValidVersion(NPM_SYSTEM, "3.0.0-beta.1")).toBe(true);
      expect(isValidVersion(NPM_SYSTEM, "4.0.0+sha.12345")).toBe(true);
    });

    it("should invalidate incorrect NPM semver versions", () => {
      expect(isValidVersion(NPM_SYSTEM, "foo")).toBe(false);
      expect(isValidVersion(NPM_SYSTEM, "version 1.0")).toBe(false);
      expect(isValidVersion(NPM_SYSTEM, "1.0")).toBe(false);
      expect(isValidVersion(NPM_SYSTEM, "1")).toBe(false);
      expect(isValidVersion(NPM_SYSTEM, "latest")).toBe(false);
      expect(isValidVersion(NPM_SYSTEM, undefined)).toBe(false);
    });
  });

  // MAVEN System - uses NUMERIC_VERSION_REGEX validation (starts with numbers)
  describe("mAVEN system versions", () => {
    it("should validate valid MAVEN numeric versions", () => {
      expect(isValidVersion(MAVEN_SYSTEM, "1.0.0")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "1.2.3")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "0.1.0")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "2.0.0-alpha")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "3.0.0-SNAPSHOT")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "4.0.0.RELEASE")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "1")).toBe(true);
      expect(isValidVersion(MAVEN_SYSTEM, "1.0")).toBe(true);
    });

    it("should invalidate incorrect MAVEN versions", () => {
      expect(isValidVersion(MAVEN_SYSTEM, "v1.0.0")).toBe(false); // Can't start with v
      expect(isValidVersion(MAVEN_SYSTEM, "version 1.0")).toBe(false); // No spaces
      expect(isValidVersion(MAVEN_SYSTEM, "latest")).toBe(false); // Must start with number
      expect(isValidVersion(MAVEN_SYSTEM, undefined)).toBe(false);
    });
  });

  // PYTHON System - uses NUMERIC_VERSION_REGEX validation (same as Maven)
  describe("pYTHON system versions", () => {
    it("should validate valid PYTHON numeric versions", () => {
      expect(isValidVersion(PYTHON_SYSTEM, "1.0.0")).toBe(true);
      expect(isValidVersion(PYTHON_SYSTEM, "1.2.3")).toBe(true);
      expect(isValidVersion(PYTHON_SYSTEM, "0.1.0")).toBe(true);
      expect(isValidVersion(PYTHON_SYSTEM, "2.0.0a1")).toBe(true); // Python style alpha
      expect(isValidVersion(PYTHON_SYSTEM, "3.0.0b2")).toBe(true); // Python style beta
      expect(isValidVersion(PYTHON_SYSTEM, "4.0.0rc1")).toBe(true); // Python style release candidate
      expect(isValidVersion(PYTHON_SYSTEM, "1")).toBe(true);
      expect(isValidVersion(PYTHON_SYSTEM, "1.0")).toBe(true);
    });

    it("should invalidate incorrect PYTHON versions", () => {
      expect(isValidVersion(PYTHON_SYSTEM, "v1.0.0")).toBe(false); // Can't start with v
      expect(isValidVersion(PYTHON_SYSTEM, "version 1.0")).toBe(false); // No spaces
      expect(isValidVersion(PYTHON_SYSTEM, "latest")).toBe(false); // Must start with number
      expect(isValidVersion(PYTHON_SYSTEM, undefined)).toBe(false);
    });
  });

  // GO System - uses a specific regex that requires 'v' prefix
  describe("gO system versions", () => {
    it("should validate valid GO versions", () => {
      expect(isValidVersion(GO_SYSTEM, "v1.0.0")).toBe(true);
      expect(isValidVersion(GO_SYSTEM, "v1.2.3")).toBe(true);
      expect(isValidVersion(GO_SYSTEM, "v0.1.0")).toBe(true);
      expect(isValidVersion(GO_SYSTEM, "v2.0.0-alpha")).toBe(true);
      expect(isValidVersion(GO_SYSTEM, "v3.0.0-beta.1")).toBe(true);
      expect(isValidVersion(GO_SYSTEM, "v1")).toBe(true);
      expect(isValidVersion(GO_SYSTEM, "v1.0")).toBe(true);
    });

    it("should invalidate incorrect GO versions", () => {
      expect(isValidVersion(GO_SYSTEM, "1.0.0")).toBe(false); // Missing v prefix
      expect(isValidVersion(GO_SYSTEM, "version 1.0")).toBe(false); // Invalid format
      expect(isValidVersion(GO_SYSTEM, "latest")).toBe(false); // Invalid format
      expect(isValidVersion(GO_SYSTEM, "master")).toBe(false); // Invalid format
      expect(isValidVersion(GO_SYSTEM, undefined)).toBe(false);
    });
  });
});

describe("resolveVersion", () => {
  // NPM System - uses semver resolution
  describe("nPM system version resolution", () => {
    it("should return the minimum version for semver ranges", () => {
      expect(resolveVersion(NPM_SYSTEM, "^1.0.0")).toBe("1.0.0");
      expect(resolveVersion(NPM_SYSTEM, "~2.5.0")).toBe("2.5.0");
      expect(resolveVersion(NPM_SYSTEM, ">=3.0.0")).toBe("3.0.0");
      expect(resolveVersion(NPM_SYSTEM, "1.x")).toBe("1.0.0");
      expect(resolveVersion(NPM_SYSTEM, "*")).toBe("0.0.0");
      expect(resolveVersion(NPM_SYSTEM, "1.2.3 - 2.3.4")).toBe("1.2.3");
    });

    it("should return exact versions as-is", () => {
      expect(resolveVersion(NPM_SYSTEM, "1.0.0")).toBe("1.0.0");
      expect(resolveVersion(NPM_SYSTEM, "2.5.3")).toBe("2.5.3");
      expect(resolveVersion(NPM_SYSTEM, "3.0.0-beta.1")).toBe("3.0.0-beta.1");
    });

    it("should handle undefined version", () => {
      expect(resolveVersion(NPM_SYSTEM, undefined)).toBeUndefined();
    });
  });

  // Non-semver systems (MAVEN, PYTHON, GO) should return version as-is
  describe("non-semver system version resolution", () => {
    it("should return Maven versions as-is", () => {
      expect(resolveVersion(MAVEN_SYSTEM, "1.0.0")).toBe("1.0.0");
      expect(resolveVersion(MAVEN_SYSTEM, "2.0.0-SNAPSHOT")).toBe(
        "2.0.0-SNAPSHOT",
      );
      expect(resolveVersion(MAVEN_SYSTEM, "3.2.1.RELEASE")).toBe(
        "3.2.1.RELEASE",
      );
    });

    it("should return Python versions as-is", () => {
      expect(resolveVersion(PYTHON_SYSTEM, "1.0.0")).toBe("1.0.0");
      expect(resolveVersion(PYTHON_SYSTEM, "2.0.0a1")).toBe("2.0.0a1");
      expect(resolveVersion(PYTHON_SYSTEM, "3.7.4rc1")).toBe("3.7.4rc1");
    });

    it("should return Go versions as-is", () => {
      expect(resolveVersion(GO_SYSTEM, "v1.0.0")).toBe("v1.0.0");
      expect(resolveVersion(GO_SYSTEM, "v0.12.3")).toBe("v0.12.3");
      expect(resolveVersion(GO_SYSTEM, "v2.0.0-alpha")).toBe("v2.0.0-alpha");
    });

    it("should handle undefined version for non-semver systems", () => {
      expect(resolveVersion(MAVEN_SYSTEM, undefined)).toBeUndefined();
      expect(resolveVersion(PYTHON_SYSTEM, undefined)).toBeUndefined();
      expect(resolveVersion(GO_SYSTEM, undefined)).toBeUndefined();
    });
  });
});
