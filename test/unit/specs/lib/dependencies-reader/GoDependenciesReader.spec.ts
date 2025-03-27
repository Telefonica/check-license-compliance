// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import fsExtra from "fs-extra";

import type {
  SystemDependenciesReaderOptions,
  GoDependenciesReaderOptions,
} from "../../../../../src/lib/dependencies-reader/DependenciesReader.types";
import { GoDependenciesReader } from "../../../../../src/lib/dependencies-reader/GoDependenciesReader";
import * as Helpers from "../../../../../src/lib/dependencies-reader/Helpers";

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

describe("goDependenciesReader", () => {
  let reader: GoDependenciesReader;
  const mockOptions: SystemDependenciesReaderOptions<GoDependenciesReaderOptions> =
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

    reader = new GoDependenciesReader(mockOptions);
  });

  it("should be instantiated correctly", () => {
    expect(reader).toBeDefined();
    expect(reader.readDependencies).toBeDefined();
  });

  it("should correctly parse single require statements", async () => {
    // Mock file content with single require statements
    const mockGoMod = `
module example.com/project

go 1.16

require github.com/pkg/errors v0.9.1
require golang.org/x/text v0.3.7
`;

    // @ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockGoMod);

    const deps = await reader.readFileDependencies("go.mod", false);

    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        system: "GO",
        name: "github.com/pkg/errors",
        version: "v0.9.1",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
    expect(deps[1]).toEqual(
      expect.objectContaining({
        system: "GO",
        name: "golang.org/x/text",
        version: "v0.3.7",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
  });

  it("should correctly parse require blocks", async () => {
    // Mock file content with require block
    const mockGoMod = `
module example.com/project

go 1.16

require (
    github.com/pkg/errors v0.9.1
    golang.org/x/text v0.3.7
    github.com/foo/testify v1.7.0
)
`;

    // @ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockGoMod);

    const deps = await reader.readFileDependencies("go.mod", false);

    expect(deps).toHaveLength(3);
    expect(deps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "github.com/pkg/errors",
          version: "v0.9.1",
        }),
        expect.objectContaining({
          name: "golang.org/x/text",
          version: "v0.3.7",
        }),
        expect.objectContaining({
          name: "github.com/foo/testify",
          version: "v1.7.0",
        }),
      ]),
    );
  });

  it("should handle development dependencies", async () => {
    const mockGoMod = `
module example.com/project

go 1.16

require github.com/pkg/errors v0.9.1
`;

    // @ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockGoMod);

    const deps = await reader.readFileDependencies("go.mod", true);

    expect(deps).toHaveLength(1);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "github.com/pkg/errors",
        development: true,
        production: false,
      }),
    );
  });

  it("should handle comments in go.mod files", async () => {
    const mockGoMod = `
module example.com/project

go 1.16

// This is a comment
require (
    // Another comment
    github.com/pkg/errors v0.9.1
    // Yet another comment
    golang.org/x/text v0.3.7
)
`;

    // @ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockGoMod);

    const deps = await reader.readFileDependencies("go.mod", false);

    expect(deps).toHaveLength(2);
    expect(deps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "github.com/pkg/errors",
        }),
        expect.objectContaining({
          name: "golang.org/x/text",
        }),
      ]),
    );
  });

  it("should handle malformed dependency declarations", async () => {
    const mockGoMod = `
module example.com/project

go 1.16

require (
    github.com/pkg/errors v0.9.1
    invalid-line-without-version
    golang.org/x/text v0.3.7
)
`;

    // @ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockGoMod);

    const deps = await reader.readFileDependencies("go.mod", false);

    expect(deps).toHaveLength(2);
    expect(deps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "github.com/pkg/errors",
        }),
        expect.objectContaining({
          name: "golang.org/x/text",
        }),
      ]),
    );
  });

  it("should handle errors when resolving versions", async () => {
    const mockGoMod = `
module example.com/project

go 1.16

require github.com/pkg/errors v0.9.1
`;

    // Mock the resolveVersion method to throw an error
    jest.spyOn(Helpers, "resolveVersion").mockImplementation(() => {
      throw new Error("Version resolution error");
    });

    // @ts-expect-error mock fs-extra
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockGoMod);

    const deps = await reader.readFileDependencies("go.mod", false);

    expect(deps).toHaveLength(1);
    // Should use the original version when resolution fails
    expect(deps[0].version).toBe("v0.9.1");
    expect(deps[0].resolvedVersion).toBe("v0.9.1");
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
