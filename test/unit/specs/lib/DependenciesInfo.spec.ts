// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { DependenciesInfo } from "../../../../src/lib/DependenciesInfo";
import type { DependencyInfo } from "../../../../src/lib/DependenciesInfo.types";
import type { InsightsClient } from "../../../../src/lib/proto/deps_dev/v3/Insights";

jest.mock("../../../../src/lib/Logger");

const loggerMock = {
  silly: jest.fn(),
  verbose: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock<typeof import("../../../../src/lib/Logger")>(
  "../../../../src/lib/Logger",
  //@ts-expect-error partial mock
  () => ({
    createLogger: jest.fn(() => loggerMock),
  }),
);

// @ts-expect-error partial mock
jest.mock<typeof import("@grpc/proto-loader")>("@grpc/proto-loader", () => ({
  loadSync: jest.fn().mockReturnValue({}),
}));

// @ts-expect-error partial mock
jest.mock<typeof import("@grpc/grpc-js")>("@grpc/grpc-js", () => ({
  credentials: { createSsl: jest.fn() },
  loadPackageDefinition: jest.fn().mockReturnValue({
    deps_dev: { v3: { Insights: jest.fn() } },
  }),
  status: {
    DEADLINE_EXCEEDED: 4,
  },
}));

// Mock DirectDependenciesReader
jest.mock<
  typeof import("../../../../src/lib/dependencies-reader/DependenciesReader")
>("../../../../src/lib/dependencies-reader/DependenciesReader", () => {
  return {
    DirectDependenciesReader: jest.fn().mockImplementation(() => {
      return {
        readDependencies: jest.fn().mockResolvedValue([]),
        errors: [],
        warnings: [],
      };
    }),
  };
});

describe("dependenciesInfo", () => {
  let dependenciesInfo: DependenciesInfo;
  let mockGrpcClient: InsightsClient;

  beforeEach(() => {
    dependenciesInfo = new DependenciesInfo({
      //@ts-expect-error partial mock
      logger: loggerMock,
      onlyDirect: true,
      production: true,
      development: true,
    });
    mockGrpcClient = dependenciesInfo["_depsDevInsightsClient"];
  });

  it("should initialize gRPC client", () => {
    expect(dependenciesInfo).toBeDefined();
    expect(mockGrpcClient).toBeDefined();
  });

  it("should get dependencies correctly", async () => {
    const result = await dependenciesInfo.getDependencies();

    expect(result).toEqual([]);
  });

  it("should handle errors during dependency fetching", async () => {
    const error = new Error("Test error");
    jest
      // @ts-expect-error mock private method
      .spyOn(dependenciesInfo as DependenciesInfo, "_readProjectDependencies")
      .mockRejectedValue(error as never);

    await expect(dependenciesInfo.getDependencies()).rejects.toThrow(
      "Test error",
    );
  });

  it("should clear cache before fetching dependencies", async () => {
    // @ts-expect-error mock private method
    const clearCacheSpy = jest.spyOn(dependenciesInfo, "_clearCache");
    await dependenciesInfo.getDependencies();

    expect(clearCacheSpy).toHaveBeenCalled();
  });

  it("should properly expose errors getter", async () => {
    const testError = new Error("Test error");

    dependenciesInfo["_errors"] = [testError];

    expect(dependenciesInfo.errors).toEqual([testError]);
  });

  it("should properly expose warnings getter", async () => {
    const testWarning = "Test warning";

    dependenciesInfo["_warnings"] = [testWarning];

    expect(dependenciesInfo.warnings).toEqual([testWarning]);
  });

  it("should wait for ongoing request before starting a new one", async () => {
    // @ts-expect-error mock private method
    const getDependenciesSpy = jest.spyOn(dependenciesInfo, "_getDependencies");

    // Set up a promise that we can control
    const promise = new Promise<DependencyInfo[]>((resolve) => {
      setTimeout(() => resolve([]), 10);
    });

    dependenciesInfo["_getDependenciesPromise"] = promise;

    await dependenciesInfo.getDependencies();

    expect(getDependenciesSpy).toHaveBeenCalled();
  });

  it("should collect errors and warnings from the project dependencies reader", async () => {
    const testError = new Error("Reader error");
    const testWarning = "Reader warning";

    // Mock the project dependencies reader with errors and warnings
    const mockReader = {
      readDependencies: jest.fn().mockResolvedValue([]),
      errors: [testError],
      warnings: [testWarning],
    };

    // @ts-expect-error mock private property
    dependenciesInfo["_projectDependenciesReader"] = mockReader;

    // Mock the methods to avoid actually executing them

    jest
      // @ts-expect-error mock private methods
      .spyOn(dependenciesInfo, "_requestDependenciesInfo")
      // @ts-expect-error mock private methods
      .mockResolvedValue(undefined);

    jest
      // @ts-expect-error mock private methods
      .spyOn(dependenciesInfo, "_fillDependenciesInfo")
      // @ts-expect-error mock private methods
      .mockImplementation(() => {});

    await dependenciesInfo["_getDependencies"]();

    // Check if the errors and warnings were collected
    expect(dependenciesInfo.errors).toContain(testError);
    expect(dependenciesInfo.warnings).toContain(testWarning);
  });

  describe("module version resolution", () => {
    it("should store version requests in cache", async () => {
      const mockVersion = "1.0.0";

      jest
        // @ts-expect-error mock private method
        .spyOn(dependenciesInfo, "_getModuleDefaultVersion")
        // @ts-expect-error mock private method
        .mockResolvedValue(mockVersion);

      const result = await dependenciesInfo[
        "_getModuleDefaultVersionFromCache"
      ]({
        system: "NPM",
        name: "test-package",
      });

      expect(result).toBe(mockVersion);

      // Check that it's stored in cache
      expect(
        dependenciesInfo["_moduleVersionRequests"]["test-package"],
      ).toBeDefined();

      // Request again should use cache
      const cachedResult = await dependenciesInfo[
        "_getModuleDefaultVersionFromCache"
      ]({
        system: "NPM",
        name: "test-package",
      });

      expect(cachedResult).toBe(mockVersion);
    });
  });

  describe("dependency processing", () => {
    it("should handle project dependencies correctly", async () => {
      const mockDependencies = [
        {
          system: "NPM",
          id: "NPM:test@1.0.0",
          name: "test",
          version: "1.0.0",
          resolvedVersion: "1.0.0",
          origin: "package.json",
          development: false,
          production: true,
        },
      ];

      jest
        .spyOn(
          dependenciesInfo["_projectDependenciesReader"],
          "readDependencies",
        )
        .mockImplementation()
        // @ts-expect-error mock private property and methods
        .mockResolvedValue(mockDependencies);

      jest
        // @ts-expect-error mock private methods
        .spyOn(dependenciesInfo, "_requestDependenciesInfo")
        // @ts-expect-error mock private methods
        .mockResolvedValue(undefined);
      jest
        // @ts-expect-error mock private methods
        .spyOn(dependenciesInfo, "_fillDependenciesInfo")
        // @ts-expect-error mock private methods
        .mockImplementation(() => {});

      await dependenciesInfo["_getDependencies"]();

      // Check if direct dependencies were properly tracked
      expect(dependenciesInfo["_directDependencies"]).toContain(
        "NPM:test@1.0.0",
      );
      expect(dependenciesInfo["_directProdDependencies"]).toContain(
        "NPM:test@1.0.0",
      );
    });
  });
});
