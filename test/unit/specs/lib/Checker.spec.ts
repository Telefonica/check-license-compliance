// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import fsExtra from "fs-extra";
import satisfies from "spdx-satisfies";

import { DependenciesInfo } from "../../../../src/lib/DependenciesInfo";
import { Checker } from "../../../../src/lib/index";

jest.mock<typeof import("../../../../src/lib/DependenciesInfo")>(
  "../../../../src/lib/DependenciesInfo",
  () => ({
    DependenciesInfo: jest.fn().mockImplementation(() => ({
      getDependencies: jest.fn(),
    })),
  }),
);
jest.mock("spdx-satisfies");
jest.mock("fs-extra");

describe("checker", () => {
  let getDependenciesMock: jest.Mock;
  let dependenciesInfoMock: jest.Mocked<DependenciesInfo>;

  beforeEach(() => {
    jest.clearAllMocks();
    getDependenciesMock = jest.fn().mockResolvedValue([]);
    // @ts-expect-error mockImplementation is not typed
    dependenciesInfoMock = () => {
      return {
        getDependencies: getDependenciesMock,
        errors: [],
        warnings: [],
      };
    };
    jest.mocked(fsExtra.readJson).mockResolvedValue(["MIT", "GPL-3.0"]);
    // @ts-expect-error mockImplementation is not typed
    jest.mocked(DependenciesInfo).mockImplementation(dependenciesInfoMock);
  });

  describe("check method", () => {
    it("should return valid result when no dependencies are found", async () => {
      getDependenciesMock.mockResolvedValue([]);
      const checker = new Checker({ log: "error" });
      const result = await checker.check();

      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([]);
      expect(result.allowed).toEqual([]);
    });

    it("should classify licenses correctly", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: ["MIT"],
          direct: true,
          origins: [],
          ancestors: [],
          production: true,
          development: false,
          dependencies: [],
          errors: [],
          warnings: [],
        },
      ]);
      jest.mocked(satisfies).mockImplementation(() => true);
      const checker = new Checker({
        log: "error",
        licenses: {
          allowed: ["MIT"],
          forbidden: ["GPL-3.0"],
          warning: ["LGPL-3.0"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["MIT"],
        }),
      ]);
      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([]);
    });

    it("should handle unknown licenses", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: ["UNKNOWN"],
          direct: true,
          origins: [],
          ancestors: [],
          production: true,
          development: false,
          dependencies: [],
          errors: [],
          warnings: [],
        },
      ]);
      jest.mocked(satisfies).mockImplementation(() => false);
      const checker = new Checker({
        log: "error",
        licenses: {
          unknown: "forbidden",
        },
      });
      const result = await checker.check();

      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["UNKNOWN"],
        }),
      ]);
      expect(result.warning).toEqual([]);
    });
  });
});
