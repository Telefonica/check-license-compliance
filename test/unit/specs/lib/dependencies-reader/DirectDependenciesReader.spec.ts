// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { DirectDependenciesReader } from "../../../../../src/lib/dependencies-reader/DependenciesReader";
import { GoDependenciesReader } from "../../../../../src/lib/dependencies-reader/GoDependenciesReader";
import { MavenDependenciesReader } from "../../../../../src/lib/dependencies-reader/MavenDependenciesReader";
import { NpmDependenciesReader } from "../../../../../src/lib/dependencies-reader/NpmDependenciesReader";
import { PythonDependenciesReader } from "../../../../../src/lib/dependencies-reader/PythonDependenciesReader";

// Mock the individual readers
jest.mock("../../../../../src/lib/dependencies-reader/NpmDependenciesReader");
jest.mock("../../../../../src/lib/dependencies-reader/MavenDependenciesReader");
jest.mock(
  "../../../../../src/lib/dependencies-reader/PythonDependenciesReader",
);
jest.mock("../../../../../src/lib/dependencies-reader/GoDependenciesReader");

// Mock logger
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
};

describe("directDependenciesReader", () => {
  let directDependenciesReader: DirectDependenciesReader;

  beforeEach(() => {
    jest.resetAllMocks();

    // Setup mock implementations
    const mockDependencies = {
      npm: [{ id: "NPM:package@1.0.0", system: "NPM" }],
      maven: [{ id: "MAVEN:group:artifact@1.0.0", system: "MAVEN" }],
      python: [{ id: "PYPI:package@1.0.0", system: "PYPI" }],
      go: [{ id: "GO:package@1.0.0", system: "GO" }],
    };

    const mockErrors = {
      npm: [new Error("NPM error")],
      maven: [new Error("Maven error")],
      python: [],
      go: [],
    };

    const mockWarnings = {
      npm: ["NPM warning"],
      maven: [],
      python: ["Python warning"],
      go: [],
    };

    // Mock NpmDependenciesReader
    // @ts-expect-error mock
    jest.mocked(NpmDependenciesReader).mockImplementation(() => ({
      readDependencies: jest.fn().mockResolvedValue(mockDependencies.npm),
      errors: mockErrors.npm,
      warnings: mockWarnings.npm,
    }));

    // Mock MavenDependenciesReader
    // @ts-expect-error mock
    jest.mocked(MavenDependenciesReader).mockImplementation(() => ({
      readDependencies: jest.fn().mockResolvedValue(mockDependencies.maven),
      errors: mockErrors.maven,
      warnings: mockWarnings.maven,
    }));

    // Mock PythonDependenciesReader
    // @ts-expect-error mock
    jest.mocked(PythonDependenciesReader).mockImplementation(() => ({
      readDependencies: jest.fn().mockResolvedValue(mockDependencies.python),
      errors: mockErrors.python,
      warnings: mockWarnings.python,
    }));

    // Mock GoDependenciesReader
    // @ts-expect-error mock
    jest.mocked(GoDependenciesReader).mockImplementation(() => ({
      readDependencies: jest.fn().mockResolvedValue(mockDependencies.go),
      errors: mockErrors.go,
      warnings: mockWarnings.go,
    }));

    directDependenciesReader = new DirectDependenciesReader({
      // @ts-expect-error mock logger
      logger: mockLogger,
      development: true,
      production: true,
    });
  });

  it("should be instantiated correctly", () => {
    expect(directDependenciesReader).toBeDefined();
    expect(NpmDependenciesReader).toHaveBeenCalled();
    expect(MavenDependenciesReader).toHaveBeenCalled();
    expect(PythonDependenciesReader).toHaveBeenCalled();
    expect(GoDependenciesReader).toHaveBeenCalled();
  });

  it("should read dependencies from all systems", async () => {
    const dependencies = await directDependenciesReader.readDependencies();

    // Should have called readDependencies on all readers
    const npmReader = jest.mocked(NpmDependenciesReader).mock.results[0].value;
    const mavenReader = jest.mocked(MavenDependenciesReader).mock.results[0]
      .value;
    const pythonReader = jest.mocked(PythonDependenciesReader).mock.results[0]
      .value;
    const goReader = jest.mocked(GoDependenciesReader).mock.results[0].value;

    expect(npmReader.readDependencies).toHaveBeenCalled();
    expect(mavenReader.readDependencies).toHaveBeenCalled();
    expect(pythonReader.readDependencies).toHaveBeenCalled();
    expect(goReader.readDependencies).toHaveBeenCalled();

    // Should return all dependencies from all readers
    expect(dependencies).toHaveLength(4);
    // eslint-disable-next-line jest/max-expects
    expect(dependencies.map((d) => d.system)).toEqual([
      "NPM",
      "MAVEN",
      "PYPI",
      "GO",
    ]);

    // Should log the reading process
    // eslint-disable-next-line jest/max-expects
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Reading project dependencies",
    );
  });

  it("should collect errors from all readers", async () => {
    await directDependenciesReader.readDependencies();

    // Should have collected errors from all readers
    expect(directDependenciesReader.errors).toHaveLength(2);
    expect(directDependenciesReader.errors[0].message).toBe("NPM error");
    expect(directDependenciesReader.errors[1].message).toBe("Maven error");
  });

  it("should collect warnings from all readers", async () => {
    await directDependenciesReader.readDependencies();

    // Should have collected warnings from all readers
    expect(directDependenciesReader.warnings).toHaveLength(2);
    expect(directDependenciesReader.warnings).toContain("NPM warning");
    expect(directDependenciesReader.warnings).toContain("Python warning");
  });
});
