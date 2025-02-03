// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { Checker } from "../../../src/lib/index";
import { init } from "license-checker";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore We don't want to type the library
import satisfies from "../../../src/lib/spdx-satisfies";
import { unknown } from "zod";

jest.mock<typeof import("license-checker")>("license-checker", () => ({
  ...jest.requireActual("license-checker"),
  init: jest.fn(),
}));

describe("checker", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(init).mockImplementation((_options, callback) => {
      // @ts-expect-error The library typing says that requires an error, but it also passes null
      callback(null, {});
    });

    jest.mocked(satisfies).mockImplementation(() => true);
  });

  describe("check method result", () => {
    it("should be valid when license-checker does not return dependencies", async () => {
      const checker = new Checker({
        log: "error",
        licenses: {},
      });

      const result = await checker.check();

      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([]);
    });

    it("should remove licenses from warnings list when they are also forbidden", async () => {
      let call = 0;
      const responses = [
        {
          packageName: {
            licenses: ["MIT"],
          },
        },
        {
          packageName: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses[call]);
        call++;
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          forbidden: ["MIT"],
          warning: ["MIT"],
        },
      });

      const result = await checker.check();

      expect(result.forbidden).toEqual([
        {
          module: "packageName",
          licenses: ["MIT"],
          licenseFile: "",
          path: "",
          repository: "",
          publisher: "",
          email: "",
        },
      ]);
      expect(result.warning).toEqual([]);
    });

    it("should return other licenses as forbidden by default", async () => {
      jest.mocked(satisfies).mockImplementation(() => false);
      const responses = [
        {
          packageName: {
            licenses: ["FOO"],
          },
        },
        {
          packageName: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
      });

      const result = await checker.check();

      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["FOO"],
        }),
      ]);
    });

    it("should return other licenses as warning when others option is warning", async () => {
      jest.mocked(satisfies).mockImplementation(() => false);
      const responses = [
        {
          packageName: {
            licenses: ["FOO"],
          },
        },
        {
          packageName: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          forbidden: ["MIT"],
          others: "warning",
        },
      });

      const result = await checker.check();

      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["FOO"],
        }),
      ]);
    });

    it("should return unknown licenses as warning by default", async () => {
      jest.mocked(satisfies).mockImplementation(() => false);
      const responses = [
        {
          packageName: {
            licenses: "Custom: FOO",
          },
        },
        {
          packageName: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
      });

      const result = await checker.check();

      expect(result.warning).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["UNKNOWN"],
        }),
      ]);
    });

    it("should return unknown licenses as forbidden when unknown option is forbidden", async () => {
      jest.mocked(satisfies).mockImplementation(() => false);
      const responses = [
        {
          packageName: {
            licenses: "Custom: FOO",
          },
        },
        {
          packageName: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          unknown: "forbidden",
        },
      });

      const result = await checker.check();

      expect(result.warning).toEqual([]);
      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["UNKNOWN"],
        }),
      ]);
    });

    it("should consider packages without license info as unknown", async () => {
      jest.mocked(satisfies).mockImplementation(() => false);
      const responses = [
        {
          packageName: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          unknown: "forbidden",
        },
      });

      const result = await checker.check();

      expect(result.warning).toEqual([]);
      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["UNKNOWN"],
        }),
      ]);
    });

    it("should ignore allowed licenses", async () => {
      jest.mocked(satisfies).mockImplementation(() => {
        // NOTE: We simulate that the license is not recognized by the library in order to force the string comparison
        throw new Error("Invalid license");
      });
      const responses = [
        {
          packageName: {
            licenses: ["MIT"],
          },
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          allowed: ["MIT"],
        },
      });

      const result = await checker.check();

      expect(result.forbidden).toEqual([]);
      expect(result.warning).toEqual([]);
    });

    it("should add explicitly forbidden licenses as forbidden", async () => {
      jest.mocked(satisfies).mockImplementation(() => {
        // NOTE: We simulate that the license is not recognized by the library in order to force the string comparison
        throw new Error("Invalid license");
      });
      const responses = [
        {
          packageName: {
            licenses: ["MIT"],
          },
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          forbidden: ["MIT"],
          unknown: "warning",
          others: "warning",
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

    it("should add explicitly warning licenses as warning", async () => {
      jest.mocked(satisfies).mockImplementation(() => {
        // NOTE: We simulate that the license is not recognized by the library in order to force the string comparison
        throw new Error("Invalid license");
      });
      const responses = [
        {
          packageName: {
            licenses: ["MIT"],
          },
          packageName2: {},
        },
      ];
      jest.mocked(init).mockImplementation((_options, callback) => {
        // @ts-expect-error The library typing says that requires an error, but it also passes null
        callback(null, responses.shift());
      });

      const checker = new Checker({
        log: "error",
        licenses: {
          warning: ["MIT"],
          unknown: "forbidden",
          others: "forbidden",
        },
      });

      const result = await checker.check();

      expect(result.warning).toEqual([
        expect.objectContaining({
          module: "packageName",
          licenses: ["MIT"],
        }),
      ]);
      expect(result.forbidden).toEqual([
        expect.objectContaining({
          module: "packageName2",
          licenses: ["UNKNOWN"],
        }),
      ]);
    });

    it("should throw an error when license-checker fails", async () => {
      jest.mocked(init).mockImplementation((_options, callback) => {
        callback(new Error("error"), {});
      });

      const checker = new Checker({
        licenses: {},
      });

      await expect(checker.check()).rejects.toThrow("error");
    });
  });

  describe("license-checker options", () => {
    it("should pass packages option to license-checker as a semicolon separated string", async () => {
      const checker = new Checker({
        licenses: {},
        packages: ["foo", "bar"],
      });

      await checker.check();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          packages: "foo;bar",
        }),
        expect.any(Function),
      );
    });

    it("should pass excludePackages option to license-checker as a semicolon separated string", async () => {
      const checker = new Checker({
        licenses: {},
        excludePackages: ["foo", "bar"],
      });

      await checker.check();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          excludePackages: "foo;bar",
        }),
        expect.any(Function),
      );
    });

    it("should pass excludePrivatePackages option to license-checker as true by default", async () => {
      const checker = new Checker({
        licenses: {},
      });

      await checker.check();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          excludePrivatePackages: true,
        }),
        expect.any(Function),
      );
    });

    it("should pass excludePrivatePackages option to license-checker as false when defined", async () => {
      const checker = new Checker({
        licenses: {},
        excludePrivatePackages: false,
      });

      await checker.check();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          excludePrivatePackages: false,
        }),
        expect.any(Function),
      );
    });
  });
});
