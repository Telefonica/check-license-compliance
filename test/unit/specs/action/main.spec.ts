// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { existsSync } from "fs";
import { readFile } from "fs/promises";

import * as core from "@actions/core";

import { getConfig } from "../../../../src/action/Config";
import * as main from "../../../../src/action/index";
import { Checker } from "../../../../src/lib/index";

jest.mock("@actions/core");

jest.mock<typeof import("../../../../src/lib/index")>(
  "../../../../src/lib/index",
  () => ({
    ...jest.requireActual("../../../../src/lib/index"),
    Checker: jest.fn().mockImplementation(),
  }),
);

jest.mock<typeof import("fs/promises")>("fs/promises", () => ({
  ...jest.requireActual("fs/promises"),
  readFile: jest.fn().mockResolvedValue(
    `
{"licenses": {}}
    `,
  ),
}));

jest.mock<typeof import("fs")>("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn().mockReturnValue(true),
}));

// NOTE: We can't use the strip-indent package in the test environment because it is a module. We should configure Jest to use the ESM module system to use it.
function removeIndentation(str: string) {
  return str
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

describe("action", () => {
  let getInputMock: jest.SpiedFunction<typeof core.getInput>;
  let getMultilineInputMock: jest.SpiedFunction<typeof core.getMultilineInput>;
  let setFailedMock: jest.SpiedFunction<typeof core.setFailed>;
  let setOutputMock: jest.SpiedFunction<typeof core.setOutput>;
  const runMock = jest.spyOn(main, "run");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(existsSync).mockReturnValue(true);

    getInputMock = jest.spyOn(core, "getInput").mockImplementation(() => "");
    getMultilineInputMock = jest
      .spyOn(core, "getMultilineInput")
      .mockImplementation(() => []);

    setFailedMock = jest.spyOn(core, "setFailed").mockImplementation();
    setOutputMock = jest.spyOn(core, "setOutput").mockImplementation();

    jest.spyOn(core, "debug").mockImplementation();
    jest.spyOn(core, "info").mockImplementation();
    jest.spyOn(core, "warning").mockImplementation();
    jest.spyOn(core, "error").mockImplementation();
  });

  describe("configuration", () => {
    it("should set failOnNotValid as true by default", async () => {
      const config = await getConfig("/github/workspace");

      expect(config.failOnNotValid).toBe(true);
    });

    it("should throw when failOnNotValid has not a boolean value", async () => {
      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "fail-on-not-valid") {
          return "foo";
        }
        return "";
      });

      await expect(() => getConfig("/github/workspace")).rejects.toThrow(
        "Invalid boolean value",
      );
    });

    it("should throw when path has an absolute value", async () => {
      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "path") {
          return "/foo";
        }
        return "";
      });

      await expect(() => getConfig("/github/workspace")).rejects.toThrow(
        "The path input must be a relative path",
      );
    });

    it("should throw when reporter is not valid", async () => {
      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "foo";
        }
        return "";
      });

      await expect(() => getConfig("/github/workspace")).rejects.toThrow(
        "Expected 'json' | 'markdown' | 'text'",
      );
    });

    it("should set reporter as text by default", async () => {
      const config = await getConfig("/github/workspace");

      expect(config.reporter).toBe("text");
    });

    it("should set reporter from inputs", async () => {
      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "json";
        }
        return "";
      });
      const config = await getConfig("/github/workspace");

      expect(config.reporter).toBe("json");
    });

    it("should not throw when no licenses are provided", async () => {
      jest.mocked(readFile).mockResolvedValueOnce("");

      const config = await getConfig("/github/workspace");

      expect(config.licenses).toBeUndefined();
    });

    it("should get config from config input", async () => {
      getMultilineInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "config") {
          return [
            '{"licenses": {"allowed": ["MIT"]}, "log": "debug", "reporter": "json"}',
          ];
        }
        return [];
      });

      const config = await getConfig("/github/workspace");

      expect(config.licenses).toEqual({
        allowed: ["MIT"],
      });
      expect(config.log).toBe("debug");
      expect(config.reporter).toBe("json");
    });

    it("should merge config from file and inputs", async () => {
      getMultilineInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "config") {
          return [
            '{"licenses": {"allowed": ["MIT"]}, "log": "debug", "reporter": "markdown"}',
          ];
        }
        return [];
      });

      jest.mocked(readFile).mockResolvedValueOnce(`
licenses: []
reporter: json
      `);

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "log") {
          return "warning";
        }
        return "";
      });

      const config = await getConfig("/github/workspace");

      expect(config.licenses).toEqual({
        allowed: ["MIT"],
      });
      expect(config.log).toBe("warning");
      expect(config.reporter).toBe("markdown");
    });

    it("should not throw when config file is not found", () => {
      jest.mocked(existsSync).mockReturnValue(false);

      expect(() => getConfig("/github/workspace")).not.toThrow();
    });

    it("should read config file from subpath when path option is provided", async () => {
      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "path") {
          return "foo";
        }
        return "";
      });

      jest.mocked(readFile).mockResolvedValueOnce(`
licenses: {}
reporter: json
      `);

      await getConfig("/github/workspace");

      expect(jest.mocked(readFile)).toHaveBeenCalledWith(
        "/github/workspace/foo/check-license-compliance.config.yml",
        "utf8",
      );
    });
  });

  describe("when all checks are valid", () => {
    it("should set as output valid true and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        "found-forbidden",
        false,
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", false);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        "No dependencies found",
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", true);
    });

    it("should return the report in markdown when reporter is markdown", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "markdown";
        }
        return "";
      });

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        "found-forbidden",
        false,
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", false);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        expect.stringContaining("✅ No dependencies found"),
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", true);
    });

    it("should return the report in json when reporter is json", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "json";
        }
        return "";
      });

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        "found-forbidden",
        false,
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", false);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        JSON.stringify({
          message: "No dependencies found",
          forbidden: [],
          warning: [],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", true);
    });
  });

  describe("when there are forbidden licenses", () => {
    it("should set as output valid false and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [
            {
              module: "foo@1.0.0",
              licenses: ["MIT"],
              origins: ["foo/path"],
              ancestors: ["foo-ancestor@1.0.0"],
              direct: false,
              version: "^1.0.0",
              resolvedVersion: "1.0.0",
            },
          ],
          warning: [],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(1, "found-forbidden", true);

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", false);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        removeIndentation(`Result: Not valid licenses


          There is 1 dependency with forbidden licenses:
          - foo@1.0.0 (1.0.0): MIT
          - Transitive dependency of foo-ancestor@1.0.0. Defined in foo/path
        `),
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", false);
      expect(setFailedMock).toHaveBeenNthCalledWith(
        1,
        "Some dependencies have not acceptable licenses.",
      );
    });

    it("should return report in markdown when defined in config", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [
            {
              module: "foo@1.0.0",
              licenses: ["MIT"],
              origins: ["foo/path"],
              ancestors: ["foo-ancestor@1.0.0"],
              direct: false,
              version: "^1.0.0",
              resolvedVersion: "1.0.0",
            },
          ],
          warning: [
            {
              module: "foo-warn@2.0.0",
              licenses: ["MIT"],
              origins: ["foo-warn/path"],
              ancestors: ["foo-warn-ancestor@2.0.0"],
              direct: true,
              version: "^1.0.0",
              resolvedVersion: "2.0.0",
            },
          ],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "markdown";
        }
        return "";
      });

      await main.run();

      expect(removeIndentation(setOutputMock.mock.calls[2][1])).toEqual(
        removeIndentation(`
            __Check License Compliance__


            ⚠️ There is 1 dependency with dangerous licenses:
            * __foo-warn@2.0.0 (2.0.0)__: MIT
              * _Direct dependency. Defined in foo-warn/path_
            
            ❌ There is 1 dependency with forbidden licenses:
            * __foo@1.0.0 (1.0.0)__: MIT
              * _Transitive dependency of foo-ancestor@1.0.0. Defined in foo/path_
            
            ❌ Result: Not valid licenses
          `),
      );
    });

    it("should return report in json when defined in config", async () => {
      const result = {
        forbidden: [
          {
            module: "foo@1.0.0",
            licenses: ["MIT"],
            origins: ["foo/path"],
            ancestors: ["foo-ancestor@1.0.0"],
            direct: false,
            version: "^1.0.0",
            resolvedVersion: "1.0.0",
          },
        ],
        warning: [
          {
            module: "foo-warn@2.0.0",
            licenses: ["MIT"],
            origins: ["foo-warn/path"],
            ancestors: ["foo-warn-ancestor@2.0.0"],
            direct: true,
            version: "^1.0.0",
            resolvedVersion: "2.0.0",
          },
        ],
        allowed: [],
        caveats: {
          errors: [],
          warnings: [],
        },
      };
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue(result),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "json";
        }
        return "";
      });

      await main.run();

      expect(setOutputMock.mock.calls[2][1]).toBe(
        JSON.stringify({
          message: "Result: Not valid licenses",
          ...result,
        }),
      );
    });
  });

  describe("when there are forbidden licenses and failOnNotValid is false", () => {
    it("should set as output valid true and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [
            {
              module: "foo-warn@2.0.0",
              licenses: ["MIT"],
              origins: ["foo-warn/path"],
              ancestors: ["foo-warn-ancestor@2.0.0"],
              direct: true,
              version: "^1.0.0",
              resolvedVersion: "2.0.0",
            },
          ],
          warning: [],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "fail-on-not-valid") {
          return "false";
        }
        return "";
      });

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(1, "found-forbidden", true);

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", false);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        removeIndentation(`Result: Not valid licenses


        There is 1 dependency with forbidden licenses:
        - foo-warn@2.0.0 (2.0.0): MIT
        - Direct dependency. Defined in foo-warn/path 
        `),
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", false);
      expect(setFailedMock).not.toHaveBeenCalled();
    });
  });

  describe("when there are warnings", () => {
    it("should set as output valid true and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [
            {
              module: "foo-warn@2.0.0",
              licenses: ["MIT"],
              origins: ["foo-warn/path"],
              ancestors: ["foo-warn-ancestor@2.0.0"],
              direct: true,
              version: "^1.0.0",
              resolvedVersion: "2.0.0",
            },
          ],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        "found-forbidden",
        false,
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", true);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        removeIndentation(`Result: Valid licenses 

        There is 1 dependency with dangerous licenses:
        - foo-warn@2.0.0 (2.0.0): MIT
        - Direct dependency. Defined in foo-warn/path 

        `),
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", true);
      expect(setFailedMock).not.toHaveBeenCalled();
    });

    it("should return report valid in markdown rep", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [
            {
              module: "foo-warn@2.0.0",
              licenses: ["MIT"],
              origins: ["foo-warn/path"],
              ancestors: ["foo-warn-ancestor@2.0.0"],
              direct: true,
              version: "^1.0.0",
              resolvedVersion: "2.0.0",
            },
            {
              module: "foo-warn@2.0.0",
              licenses: ["MIT"],
              origins: ["foo-warn/path"],
              ancestors: ["foo-warn-ancestor@2.0.0"],
              direct: true,
              version: "^1.0.0",
              resolvedVersion: "2.0.0",
            },
          ],
          allowed: [],
          caveats: {
            errors: [],
            warnings: [],
          },
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "reporter") {
          return "markdown";
        }
        return "";
      });

      await main.run();

      expect(removeIndentation(setOutputMock.mock.calls[2][1])).toEqual(
        removeIndentation(`
        __Check License Compliance__


        ⚠️ There are 2 dependencies with dangerous licenses:
        * __foo-warn@2.0.0 (2.0.0)__: MIT
          * _Direct dependency. Defined in foo-warn/path_
        * __foo-warn@2.0.0 (2.0.0)__: MIT
          * _Direct dependency. Defined in foo-warn/path_
            
        ✅ Result: Valid licenses
          `),
      );
    });
  });

  describe("when any error occurs", () => {
    it("should set action as failed", async () => {
      jest.mocked(getInputMock).mockImplementation(() => {
        throw new Error("Foo error");
      });
      jest.mocked(getMultilineInputMock).mockImplementation(() => {
        throw new Error("Foo error");
      });

      await main.run();

      expect(runMock).toHaveReturned();

      expect(setFailedMock).toHaveBeenNthCalledWith(1, "Foo error");
    });
  });
});
