// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import fsExtra from "fs-extra";

import type {
  SystemDependenciesReaderOptions,
  NpmDependenciesReaderOptions,
} from "../../../../../src/lib/dependencies-reader/DependenciesReader.types";
import * as Helpers from "../../../../../src/lib/dependencies-reader/Helpers";
import { NpmDependenciesReader } from "../../../../../src/lib/dependencies-reader/NpmDependenciesReader";

// Mock fs-extra and path modules
jest.mock("fs-extra");
jest.mock<typeof import("node:path")>("node:path", () => ({
  ...jest.requireActual("node:path"),
  resolve: jest.fn(),
  relative: jest.fn(),
}));

// Mock logger
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
};

describe("npmDependenciesReader", () => {
  let reader: NpmDependenciesReader;
  const mockOptions: SystemDependenciesReaderOptions<NpmDependenciesReaderOptions> =
    {
      // @ts-expect-error mock logger
      logger: mockLogger,
      development: true,
      production: true,
      cwd: "/mock/cwd",
    };

  beforeEach(() => {
    jest.resetAllMocks();

    // Setup default mock responses
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.resolve)
      .mockImplementation((_cwd, filePath) => `/mock/cwd/${filePath}`);
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.relative)
      .mockImplementation((_cwd, fullPath) =>
        fullPath.replace("/mock/cwd/", ""),
      );

    // Mock resolveVersion method
    jest.spyOn(Helpers, "resolveVersion").mockReturnValue("1.0.0");

    reader = new NpmDependenciesReader(mockOptions);
  });

  it("should be instantiated correctly", () => {
    expect(reader).toBeDefined();
    expect(reader.readDependencies).toBeDefined();
  });

  it("should parse dependencies from package.json with both normal and dev dependencies", async () => {
    // Mock file content with both types of dependencies
    const mockPackageJson = {
      dependencies: {
        react: "^17.0.2",
        lodash: "^4.17.21",
      },
      devDependencies: {
        jest: "^27.0.0",
        typescript: "^4.5.4",
      },
    };

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(4);

    // Check regular dependencies
    const reactDep = deps.find((d) => d.name === "react");

    expect(reactDep).toEqual(
      expect.objectContaining({
        system: "NPM",
        name: "react",
        version: "^17.0.2",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );

    const lodashDep = deps.find((d) => d.name === "lodash");

    expect(lodashDep).toEqual(
      expect.objectContaining({
        system: "NPM",
        name: "lodash",
        version: "^4.17.21",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );

    // Check dev dependencies
    const jestDep = deps.find((d) => d.name === "jest");

    expect(jestDep).toEqual(
      expect.objectContaining({
        system: "NPM",
        name: "jest",
        version: "^27.0.0",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: true,
        production: false,
      }),
    );

    const typescriptDep = deps.find((d) => d.name === "typescript");

    expect(typescriptDep).toEqual(
      expect.objectContaining({
        system: "NPM",
        name: "typescript",
        version: "^4.5.4",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: true,
        production: false,
      }),
    );
  });

  it("should handle package.json with only regular dependencies", async () => {
    const mockPackageJson = {
      dependencies: {
        react: "^17.0.2",
        lodash: "^4.17.21",
      },
    };

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(2);

    deps.forEach((dep) => {
      expect(dep.development).toBe(false);
      expect(dep.production).toBe(true);
    });
  });

  it("should handle package.json with only dev dependencies", async () => {
    const mockPackageJson = {
      devDependencies: {
        jest: "^27.0.0",
        typescript: "^4.5.4",
      },
    };

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(2);

    deps.forEach((dep) => {
      expect(dep.development).toBe(true);
      expect(dep.production).toBe(false);
    });
  });

  it("should handle package.json with no dependencies", async () => {
    const mockPackageJson = {};

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(0);
  });

  it("should handle development flag overriding dependency type", async () => {
    const mockPackageJson = {
      dependencies: {
        react: "^17.0.2",
      },
    };

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", true);

    expect(deps).toHaveLength(1);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "react",
        development: true,
        production: false, // Even though it's a regular dependency, isDevelopment=true overrides
      }),
    );
  });

  it("should generate correct dependency IDs", async () => {
    const mockPackageJson = {
      dependencies: {
        react: "^17.0.2",
      },
    };

    jest.spyOn(Helpers, "getDependencyId").mockReturnValue("NPM:react:17.0.2");

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe("NPM:react:17.0.2");
  });

  it("should handle errors when resolving versions", async () => {
    const mockPackageJson = {
      dependencies: {
        "problematic-package": "invalid-version",
      },
    };

    // Mock the resolveVersion method to throw an error
    jest.spyOn(Helpers, "resolveVersion").mockImplementation(() => {
      throw new Error("Version resolution error");
    });

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(1);
    // Should use the original version when resolution fails
    expect(deps[0].version).toBe("invalid-version");
    expect(deps[0].resolvedVersion).toBe("invalid-version");
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should handle various version formats", async () => {
    const mockPackageJson = {
      dependencies: {
        "exact-version": "1.2.3",
        "caret-range": "^2.0.0",
        "tilde-range": "~1.2.0",
        "star-range": "*",
        "tag-version": "latest",
        "github-url": "github:user/repo#branch",
        "file-path": "file:../local/path",
      },
    };

    // Reset mock to pass through version value
    jest
      .spyOn(Helpers, "resolveVersion")
      .mockImplementation((_, version) => version);

    jest.mocked(fsExtra.readJson).mockResolvedValue(mockPackageJson);

    const deps = await reader.readFileDependencies("package.json", false);

    expect(deps).toHaveLength(7);
    expect(deps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "exact-version", version: "1.2.3" }),
        expect.objectContaining({ name: "caret-range", version: "^2.0.0" }),
        expect.objectContaining({ name: "tilde-range", version: "~1.2.0" }),
        expect.objectContaining({ name: "star-range", version: "*" }),
        expect.objectContaining({ name: "tag-version", version: "latest" }),
        expect.objectContaining({
          name: "github-url",
          version: "github:user/repo#branch",
        }),
        expect.objectContaining({
          name: "file-path",
          version: "file:../local/path",
        }),
      ]),
    );
  });
});
