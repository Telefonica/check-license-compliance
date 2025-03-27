// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import fsExtra from "fs-extra";

import type {
  SystemDependenciesReaderOptions,
  PythonDependenciesReaderOptions,
} from "../../../../../src/lib/dependencies-reader/DependenciesReader.types";
import * as Helpers from "../../../../../src/lib/dependencies-reader/Helpers";
import { PythonDependenciesReader } from "../../../../../src/lib/dependencies-reader/PythonDependenciesReader";

// Mock fs-extra and path modules
jest.mock("fs-extra");
jest.mock<typeof import("node:path")>("node:path", () => ({
  ...jest.requireActual("node:path"),
  resolve: jest.fn(),
  relative: jest.fn(),
  dirname: jest.fn(),
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

describe("pythonDependenciesReader", () => {
  let reader: PythonDependenciesReader;
  const mockOptions: SystemDependenciesReaderOptions<PythonDependenciesReaderOptions> =
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
      .mockImplementation((_cwd, filePath) =>
        filePath.startsWith("/") ? filePath : `/mock/cwd/${filePath}`,
      );
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.relative)
      .mockImplementation((_cwd, fullPath) =>
        fullPath.replace("/mock/cwd/", ""),
      );
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.dirname)
      .mockImplementation((filePath) =>
        filePath.substring(0, filePath.lastIndexOf("/")),
      );

    // Mock resolveVersion method
    jest.spyOn(Helpers, "resolveVersion").mockReturnValue("1.0.0");

    reader = new PythonDependenciesReader(mockOptions);
  });

  it("should be instantiated correctly", () => {
    expect(reader).toBeDefined();
    expect(reader.readDependencies).toBeDefined();
  });

  it("should parse dependencies from a simple requirements.txt file", async () => {
    // Mock file content with simple dependencies
    const mockRequirementsTxt = `
      requests==2.28.1
      Django>=4.0.0
      pandas<=1.5.0
      numpy~=1.23.0
    `;

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    expect(deps).toHaveLength(4);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        system: "PYPI",
        name: "requests",
        version: "2.28.1",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
    expect(deps[1]).toEqual(
      expect.objectContaining({
        system: "PYPI",
        name: "Django",
        version: "4.0.0",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
    expect(deps[2]).toEqual(
      expect.objectContaining({
        system: "PYPI",
        name: "pandas",
        version: "1.5.0",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
    expect(deps[3]).toEqual(
      expect.objectContaining({
        system: "PYPI",
        name: "numpy",
        version: "1.23.0",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
  });

  it("should handle dependencies with extras in requirements.txt", async () => {
    // Mock file content with dependencies that have extras
    const mockRequirementsTxt = `
      requests[security,socks]==2.28.1
      Django>=4.0.0
    `;

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    expect(deps).toHaveLength(2);
    // Extras should be removed from the dependency name
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "requests", // Extras removed
        version: "2.28.1",
      }),
    );
    // Warning should be logged about extras
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Removed extras from dependency"),
    );
  });

  it("should handle dependencies with != operator", async () => {
    // Mock file content with != operator
    const mockRequirementsTxt = `
      requests!=2.28.1
      Django>=4.0.0
    `;

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    expect(deps).toHaveLength(2);
    // Version should be undefined for != operator
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "requests",
        version: undefined,
      }),
    );
  });

  it("should handle development flag correctly", async () => {
    const mockRequirementsTxt = `
      requests==2.28.1
      Django>=4.0.0
    `;

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", true);

    expect(deps).toHaveLength(2);

    deps.forEach((dep) => {
      expect(dep.development).toBe(true);
      expect(dep.production).toBe(false);
    });
  });

  it("should handle comments and empty lines in requirements.txt", async () => {
    const mockRequirementsTxt = `
      # This is a comment
      requests==2.28.1
      
      # Another comment
      Django>=4.0.0
      
      # Yet another comment
    `;

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    // Should have 2 dependencies, comments and empty lines should be ignored
    expect(deps).toHaveLength(2);
    expect(deps[0].name).toBe("requests");
    expect(deps[1].name).toBe("Django");
  });

  it("should handle invalid dependency format", async () => {
    const mockRequirementsTxt = `
      requests==2.28.1
      invalid-dependency-format
      Django>=4.0.0
    `;

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    // Should have 2 valid dependencies, invalid format should be ignored with warning
    expect(deps).toHaveLength(2);
    expect(deps[0].name).toBe("requests");
    expect(deps[1].name).toBe("Django");
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid dependency format"),
    );
  });

  it("should handle recursive requirements", async () => {
    const mainRequirementsTxt = `
      requests==2.28.1
      -r dev-requirements.txt
      Django>=4.0.0
    `;

    const devRequirementsTxt = `
      pytest==7.0.0
      black==22.6.0
    `;

    // Setup mocks for reading both files
    jest.mocked(fsExtra.readFile).mockImplementation(async (filePath) => {
      // eslint-disable-next-line jest/no-conditional-in-test
      if (filePath === "/mock/cwd/requirements.txt") {
        return mainRequirementsTxt;
        // eslint-disable-next-line jest/no-conditional-in-test
      } else if (filePath === "/mock/cwd/dev-requirements.txt") {
        return devRequirementsTxt;
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });

    // Mock path.resolve for the included file
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.resolve)
      .mockImplementationOnce(() => "/mock/cwd/requirements.txt") // First call for the main file
      .mockImplementationOnce(() => "/mock/cwd") // For getting dirname
      .mockImplementationOnce(() => "/mock/cwd/dev-requirements.txt"); // For resolving included file

    const deps = await reader.readFileDependencies("requirements.txt", false);

    // Should have dependencies from both files (2 from main + 2 from included)
    expect(deps).toHaveLength(4);

    const depNames = deps.map((d) => d.name);

    expect(depNames).toContain("requests");
    expect(depNames).toContain("Django");
    expect(depNames).toContain("pytest");
    expect(depNames).toContain("black");
  });

  it("should handle --requirement directive", async () => {
    const mainRequirementsTxt = `
      requests==2.28.1
      --requirement dev-requirements.txt
      Django>=4.0.0
    `;

    const devRequirementsTxt = `
      pytest==7.0.0
      black==22.6.0
    `;

    // Setup mocks for reading both files
    jest.mocked(fsExtra.readFile).mockImplementation(async (filePath) => {
      // eslint-disable-next-line jest/no-conditional-in-test
      if (filePath === "/mock/cwd/requirements.txt") {
        return mainRequirementsTxt;
        // eslint-disable-next-line jest/no-conditional-in-test
      } else if (filePath === "/mock/cwd/dev-requirements.txt") {
        return devRequirementsTxt;
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });

    // Mock path.resolve for the included file
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.resolve)
      .mockImplementationOnce(() => "/mock/cwd/requirements.txt") // First call for the main file
      .mockImplementationOnce(() => "/mock/cwd") // For getting dirname
      .mockImplementationOnce(() => "/mock/cwd/dev-requirements.txt"); // For resolving included file

    const deps = await reader.readFileDependencies("requirements.txt", false);

    // Should have dependencies from both files (2 from main + 2 from included)
    expect(deps).toHaveLength(4);
  });

  it("should skip recursive requirements when recursiveRequirements is false", async () => {
    const mainRequirementsTxt = `
      requests==2.28.1
      -r dev-requirements.txt
      Django>=4.0.0
    `;

    // Setup reader with recursiveRequirements disabled
    reader = new PythonDependenciesReader({
      ...mockOptions,
      options: {
        recursiveRequirements: false,
      },
    });

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mainRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    // Should only have the dependencies from the main file
    expect(deps).toHaveLength(2);
    expect(deps[0].name).toBe("requests");
    expect(deps[1].name).toBe("Django");
  });

  it("should handle errors when reading included files", async () => {
    const mainRequirementsTxt = `
      requests==2.28.1
      -r missing-requirements.txt
      Django>=4.0.0
    `;

    // Setup mock to return file for main but throw for included file
    jest.mocked(fsExtra.readFile).mockImplementation(async (filePath) => {
      // eslint-disable-next-line jest/no-conditional-in-test
      if (filePath === "/mock/cwd/requirements.txt") {
        return mainRequirementsTxt;
      }
      throw new Error("File not found");
    });

    // Mock path.resolve for the included file
    jest
      // eslint-disable-next-line jest/unbound-method
      .mocked(path.resolve)
      .mockImplementationOnce(() => "/mock/cwd/requirements.txt") // First call for the main file
      .mockImplementationOnce(() => "/mock/cwd") // For getting dirname
      .mockImplementationOnce(() => "/mock/cwd/missing-requirements.txt"); // For resolving included file

    const deps = await reader.readFileDependencies("requirements.txt", false);

    // Should still have the dependencies from the main file
    expect(deps).toHaveLength(2);
    expect(deps[0].name).toBe("requests");
    expect(deps[1].name).toBe("Django");
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Error reading dependencies from included file"),
      expect.any(Error),
    );
  });

  it("should handle errors when resolving versions", async () => {
    const mockRequirementsTxt = `
      requests==2.28.1
    `;

    // Mock the resolveVersion method to throw an error
    jest.spyOn(Helpers, "resolveVersion").mockImplementation(() => {
      throw new Error("Version resolution error");
    });

    //@ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockRequirementsTxt);

    const deps = await reader.readFileDependencies("requirements.txt", false);

    expect(deps).toHaveLength(1);
    // Should use the original version when resolution fails
    expect(deps[0].version).toBe("2.28.1");
    expect(deps[0].resolvedVersion).toBe("2.28.1");
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
