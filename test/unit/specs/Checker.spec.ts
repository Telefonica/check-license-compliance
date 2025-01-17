// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { Checker } from "../../../src/lib/index";
import { init } from "license-checker";

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
});
