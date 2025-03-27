// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { find } from "globule";

import { BaseSystemDependenciesReader } from "../../../../../src/lib/dependencies-reader/BaseSystemDependenciesReader";
import type {
  SystemDependenciesOptions,
  DependencyDeclaration,
} from "../../../../../src/lib/dependencies-reader/DependenciesReader.types";
import * as Helpers from "../../../../../src/lib/dependencies-reader/Helpers";

// Mock logger
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
};

// Mock globule library
// @ts-expect-error mock private methods
jest.mock<typeof import("globule")>("globule", () => ({
  find: jest.fn(),
}));

class TestSystemDependenciesReader extends BaseSystemDependenciesReader<SystemDependenciesOptions> {
  public async readFileDependencies(
    filePath: string,
    isDevelopment?: boolean,
  ): Promise<DependencyDeclaration[]> {
    return [
      {
        id: "TEST:package@1.0.0",
        system: "NPM",
        name: "package",
        version: "1.0.0",
        origin: filePath,
        production: !isDevelopment,
        development: !!isDevelopment,
      },
    ];
  }
}

describe("baseSystemDependenciesReader", () => {
  let dependenciesReader: TestSystemDependenciesReader;

  beforeEach(() => {
    jest.resetAllMocks();

    dependenciesReader = new TestSystemDependenciesReader(
      {
        // @ts-expect-error mock logger
        logger: mockLogger,
        development: true,
        production: true,
      },
      {
        system: "NPM",
        defaultInclude: ["**/*.test"],
        defaultExclude: ["**/node_modules/**"],
        defaultDevelopment: ["**/*-dev.test"],
      },
    );

    // Setup globule mock responses
    const mockFind = jest.mocked(find);
    mockFind.mockImplementation((pattern) => {
      if (pattern.includes("-dev.test")) {
        return ["file-dev.test"];
      }
      if (pattern.includes(".test")) {
        return ["file1.test", "file2.test"];
      }
      return [];
    });
  });

  it("should be instantiated correctly", () => {
    expect(dependenciesReader).toBeDefined();
    expect(dependenciesReader.readDependencies).toBeDefined();
  });

  it("should throw error if defaultInclude is not provided", () => {
    expect(() => {
      new TestSystemDependenciesReader(
        {
          // @ts-expect-error mock logger
          logger: mockLogger,
          development: true,
          production: true,
        },
        {
          system: "NPM",
          defaultInclude: undefined,
        },
      );
    }).toThrow("defaultInclude is required for system dependencies reader");
  });

  it("should resolve versions correctly", async () => {
    // Mock the resolveVersion method from Helpers
    jest.spyOn(Helpers, "resolveVersion").mockReturnValue("1.0.1");

    // Use the protected method directly
    // @ts-expect-error accessing protected method for testing
    const resolvedVersion = dependenciesReader.resolveVersion(
      "testModule",
      "^1.0.0",
    );

    expect(resolvedVersion).toBe("1.0.1");
  });

  it("should handle errors when resolving versions", async () => {
    // Mock the resolveVersion method to throw an error
    jest.spyOn(Helpers, "resolveVersion").mockImplementation(() => {
      throw new Error("Version resolution error");
    });

    // @ts-expect-error accessing protected method for testing
    const resolvedVersion = dependenciesReader.resolveVersion(
      "testModule",
      "invalid-version",
    );

    // It should return the original version
    expect(resolvedVersion).toBe("invalid-version");
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should handle extra modules", async () => {
    // Create a reader with extra modules
    const readerWithExtras = new TestSystemDependenciesReader(
      {
        // @ts-expect-error mock logger
        logger: mockLogger,
        development: true,
        production: true,
        options: {
          extraModules: ["extraPackage@1.2.3"],
        },
      },
      {
        system: "NPM",
        defaultInclude: ["**/*.test"],
      },
    );

    const dependencies = await readerWithExtras.readDependencies();

    // Check that the extra module was added
    const extraModule = dependencies.find((d) => d.name === "extraPackage");

    expect(extraModule).toBeDefined();
    expect(extraModule?.version).toBe("1.2.3");
  });

  it("should handle errors in readFileDependenciesHandlingErrors", async () => {
    // Spy on the readFileDependencies method to throw an error
    jest
      .spyOn(dependenciesReader, "readFileDependencies")
      .mockImplementation(() => {
        throw new Error("File reading error");
      });

    const result =
      await dependenciesReader.readFileDependenciesHandlingErrors(
        "testfile.js",
      );

    expect(result).toEqual([]);
    expect(dependenciesReader.errors).toHaveLength(1);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
