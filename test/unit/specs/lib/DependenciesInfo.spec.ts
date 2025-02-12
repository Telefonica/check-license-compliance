// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { DependenciesInfo } from "../../../../src/lib/DependenciesInfo";
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
}));

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
});
