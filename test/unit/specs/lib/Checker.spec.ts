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
    jest
      .mocked(fsExtra.readJson)
      .mockResolvedValue(["MIT", "GPL-3.0", "APACHE-2.0"]);
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

    it("should handle unknown licenses as warning when configured", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: [],
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
          unknown: "warning",
        },
      });
      const result = await checker.check();

      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["unknown"],
        }),
      ]);
    });

    it("should handle other licenses as forbidden by default", async () => {
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
      jest.mocked(satisfies).mockImplementation(() => false);
      const checker = new Checker({
        log: "error",
        licenses: {
          allowed: ["APACHE-2.0"],
        },
      });
      const result = await checker.check();

      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["MIT"],
        }),
      ]);
      expect(result.warning).toEqual([]);
    });

    it("should handle other licenses as warning when configured", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: ["CustomLicense"],
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
          allowed: ["MIT"],
          others: "warning",
        },
      });
      const result = await checker.check();

      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["CustomLicense"],
        }),
      ]);
    });

    it("should handle forbidden licenses correctly", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          version: "1.0.0",
          licenses: ["GPL-3.0"],
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
          allowed: [],
          forbidden: ["GPL-3.0"],
          warning: ["LGPL-3.0"],
        },
      });
      const result = await checker.check();

      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["GPL-3.0"],
        }),
      ]);
      expect(result.allowed).toEqual([]);
      expect(result.warning).toEqual([]);
    });

    it("should handle warning licenses correctly", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: ["LGPL-3.0"],
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
          allowed: [],
          forbidden: [],
          warning: ["LGPL-3.0"],
        },
      });
      const result = await checker.check();

      expect(result.warning).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["LGPL-3.0"],
        }),
      ]);
      expect(result.allowed).toEqual([]);
      expect(result.forbidden).toEqual([]);
    });

    it("should filter production dependencies", async () => {
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
        {
          id: "devPackage",
          system: "NPM",
          name: "devPackage",
          licenses: ["MIT"],
          direct: true,
          origins: [],
          ancestors: [],
          production: false,
          development: true,
          dependencies: [],
          errors: [],
          warnings: [],
        },
      ]);
      jest.mocked(satisfies).mockImplementation(() => true);
      const checker = new Checker({
        log: "error",
        production: true,
        development: false,
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("packageName");
    });

    it("should filter development dependencies", async () => {
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
        {
          id: "devPackage",
          system: "NPM",
          name: "devPackage",
          licenses: ["MIT"],
          direct: true,
          origins: [],
          ancestors: [],
          production: false,
          development: true,
          dependencies: [],
          errors: [],
          warnings: [],
        },
      ]);
      jest.mocked(satisfies).mockImplementation(() => true);
      const checker = new Checker({
        log: "error",
        production: false,
        development: true,
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("devPackage");
    });

    it("should filter dependencies as development when they are also production and should be filtered as well", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "devPackage",
          system: "NPM",
          name: "devPackage",
          licenses: ["MIT"],
          direct: true,
          origins: [],
          ancestors: [],
          production: true,
          development: true,
          dependencies: [],
          errors: [],
          warnings: [],
        },
      ]);
      jest.mocked(satisfies).mockImplementation(() => true);
      const checker = new Checker({
        log: "error",
        production: false,
        development: false,
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(0);
      expect(result.warning).toHaveLength(0);
      expect(result.forbidden).toHaveLength(0);
    });

    it("should filter by direct dependencies when onlyDirect is true", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "directPackage",
          system: "NPM",
          name: "directPackage",
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
        {
          id: "indirectPackage",
          system: "NPM",
          name: "indirectPackage",
          licenses: ["MIT"],
          direct: false,
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
        onlyDirect: true,
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("directPackage");
    });

    it("should filter by modules from configuration", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "NPM:included@1.0.0",
          system: "NPM",
          name: "included",
          version: "1.0.0",
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
        {
          id: "NPM:excluded@1.0.0",
          system: "NPM",
          name: "excluded",
          version: "1.0.0",
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
        npm: {
          modules: ["included@1.0.0"],
        },
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("NPM:included@1.0.0");
    });

    it("should exclude modules from configuration", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "NPM:included@1.0.0",
          system: "NPM",
          name: "included",
          version: "1.0.0",
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
        {
          id: "NPM:excluded@1.0.0",
          system: "NPM",
          name: "excluded",
          version: "1.0.0",
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
        npm: {
          excludeModules: ["excluded@1.0.0"],
        },
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("NPM:included@1.0.0");
    });

    it("should exclude modules from configuration when defined with system id", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "NPM:included@1.0.0",
          system: "NPM",
          name: "included",
          version: "1.0.0",
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
        {
          id: "NPM:excluded@1.0.0",
          system: "NPM",
          name: "excluded",
          version: "1.0.0",
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
        npm: {
          excludeModules: ["NPM:excluded@1.0.0"],
        },
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("NPM:included@1.0.0");
    });

    it("should exclude modules from configuration when defined with module details", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "NPM:included@1.0.0",
          system: "NPM",
          name: "included",
          version: "1.0.0",
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
        {
          id: "NPM:excluded@1.0.0",
          system: "NPM",
          name: "excluded",
          version: "1.0.0",
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
        npm: {
          excludeModules: [
            {
              name: "excluded",
            },
          ],
        },
        licenses: {
          allowed: ["MIT"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].module).toBe("NPM:included@1.0.0");
    });

    it("should handle dependency with multiple licenses", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: ["MIT", "Apache-2.0"],
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
        },
      });
      const result = await checker.check();

      expect(result.allowed).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["MIT", "Apache-2.0"],
        }),
      ]);
      expect(result.forbidden).toEqual([]);
    });

    it("should include caveats from DependenciesInfo", async () => {
      // @ts-expect-error mockImplementation is not typed
      dependenciesInfoMock = () => {
        return {
          getDependencies: getDependenciesMock,
          errors: ["Sample error"],
          warnings: ["Sample warning"],
        };
      };
      // @ts-expect-error mockImplementation is not typed
      jest.mocked(DependenciesInfo).mockImplementation(dependenciesInfoMock);

      getDependenciesMock.mockResolvedValue([]);
      const checker = new Checker({ log: "error" });
      const result = await checker.check();

      expect(result.caveats).toEqual({
        errors: ["Sample error"],
        warnings: ["Sample warning"],
      });
    });

    it("should handle non-SPDX licenses using string comparison", async () => {
      getDependenciesMock.mockResolvedValue([
        {
          id: "packageName",
          system: "NPM",
          name: "packageName",
          licenses: ["NonStandardLicense"],
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

      // Mock satisfies to throw for non-standard licenses
      jest.mocked(satisfies).mockImplementation(() => {
        throw new Error("Invalid license");
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          allowed: ["NonStandardLicense"],
        },
      });
      const result = await checker.check();

      expect(result.allowed).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["NonStandardLicense"],
        }),
      ]);
      expect(result.forbidden).toEqual([]);
    });
  });
});
