// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";
import * as main from "../../../src/main";

import { Checker } from "../../../src/lib/index";
import { getConfig } from "../../../src/Config";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

jest.mock<typeof import("../../../src/lib/index")>(
  "../../../src/lib/index",
  () => ({
    ...jest.requireActual("../../../src/lib/index"),
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

  describe("when node_modules folder does not exist", () => {
    it("should set a warning in the output and not fail", async () => {
      jest.mocked(existsSync).mockReturnValue(false);

      getMultilineInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "config") {
          return [
            '{"licenses": {"allowed": ["MIT"]}, "log": "debug", "reporter": "text"}',
          ];
        }
        return [];
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
        "node_modules folder not found. Please install NPM dependencies before running this action.",
      );

      expect(core.warning).toHaveBeenCalledWith(
        "node_modules folder not found. Please install NPM dependencies before running this action.",
      );

      expect(setFailedMock).not.toHaveBeenCalled();
    });

    it("should return report in markdown when defined in config", async () => {
      jest.mocked(existsSync).mockReturnValue(false);

      getMultilineInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "config") {
          return [
            '{"licenses": {"allowed": ["MIT"]}, "log": "debug", "reporter": "markdown"}',
          ];
        }
        return [];
      });

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        expect.stringContaining("⚠️ node_modules folder not found"),
      );
    });

    it("should return report in json when defined in config", async () => {
      jest.mocked(existsSync).mockReturnValue(false);

      getMultilineInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "config") {
          return [
            '{"licenses": {"allowed": ["MIT"]}, "log": "debug", "reporter": "json"}',
          ];
        }
        return [];
      });

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        expect.stringContaining(
          '{"message":"node_modules folder not found. Please install NPM dependencies before running this action.","forbidden":[],"warning":[]}',
        ),
      );
    });
  });

  describe("configuration", () => {
    it("should set failOnNotValid as true by default", async () => {
      const config = await getConfig();

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

      await expect(() => getConfig()).rejects.toThrow("Invalid boolean value");
    });

    it("should set reporter as text by default", async () => {
      const config = await getConfig();

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
      const config = await getConfig();

      expect(config.reporter).toBe("json");
    });

    it("should throw when no licenses are provided", async () => {
      jest.mocked(readFile).mockResolvedValueOnce("");

      await expect(() => getConfig()).rejects.toThrow(
        'Validation error: Required at "licenses"',
      );
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

      const config = await getConfig();

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

      const config = await getConfig();

      expect(config.licenses).toEqual({
        allowed: ["MIT"],
      });
      expect(config.log).toBe("warning");
      expect(config.reporter).toBe("markdown");
    });
  });

  describe("when all checks are valid", () => {
    it("should set as output valid true and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [],
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
        "All dependencies have acceptable licenses.",
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", true);
    });

    it("should return the report in markdown when reporter is markdown", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [],
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
        expect.stringContaining("✅ All dependencies have acceptable licenses"),
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", true);
    });

    it("should return the report in json when reporter is json", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [],
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
        '{"message":"All dependencies have acceptable licenses.","forbidden":[],"warning":[]}',
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
              module: "foo",
              licenses: "MIT",
            },
          ],
          warning: [],
        }),
      }));

      await main.run();

      expect(setOutputMock).toHaveBeenNthCalledWith(1, "found-forbidden", true);

      expect(setOutputMock).toHaveBeenNthCalledWith(2, "found-warning", false);

      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        "report",
        "1 dependency has forbidden licenses.\n0 dependencies have dangerous licenses.",
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
              module: "foo",
              licenses: "MIT",
            },
          ],
          warning: [
            {
              module: "bar",
              licenses: "GPL",
            },
          ],
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
    
            ❌ There is 1 dependency with forbidden license:
            * __foo__: MIT
            
            ⚠️ There is 1 dependency with dangerous license:
            * __bar__: GPL
            
            ❌ Result: Not valid
          `),
      );
    });

    it("should return report in json when defined in config", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [
            {
              module: "foo",
              licenses: "MIT",
            },
          ],
          warning: [
            {
              module: "bar",
              licenses: "GPL",
            },
          ],
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

      expect(setOutputMock.mock.calls[2][1]).toBe(
        '{"message":"1 dependency has forbidden licenses. 1 dependency has dangerous licenses.","forbidden":[{"module":"foo","licenses":"MIT"}],"warning":[{"module":"bar","licenses":"GPL"}]}',
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
              module: "foo",
              licenses: "MIT",
            },
          ],
          warning: [],
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
        "1 dependency has forbidden licenses.\n0 dependencies have dangerous licenses.",
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", false);
      expect(setFailedMock).not.toHaveBeenCalled();
    });
  });

  describe("when there are warnings and allowWarnings is true", () => {
    it("should set as output valid true and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [
            {
              module: "foo",
              licenses: "MIT",
            },
          ],
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "allow-warnings") {
          return "true";
        }
        return "";
      });

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
        "0 dependencies have forbidden licenses.\n1 dependency has dangerous licenses.",
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
              module: "bar",
              licenses: "GPL",
            },
            {
              module: "foo",
              licenses: ["MIT", "Apache-2.0"],
            },
          ],
        }),
      }));

      getInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "allow-warnings") {
          return "true";
        }
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
            * __bar__: GPL
            * __foo__: MIT, Apache-2.0
            
            ✅ Result: Valid
          `),
      );
    });
  });

  describe("when there are warnings and allowWarnings is false", () => {
    it("should set as output valid false and the result report", async () => {
      // @ts-expect-error We don't want to mock the whole module
      jest.mocked(Checker).mockImplementation(() => ({
        check: jest.fn().mockReturnValue({
          forbidden: [],
          warning: [
            {
              module: "foo",
              licenses: "MIT",
            },
          ],
        }),
      }));

      getMultilineInputMock.mockImplementation((name: string) => {
        // eslint-disable-next-line jest/no-conditional-in-test
        if (name === "config") {
          return ['{"allowWarnings": false}'];
        }
        return [];
      });

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
        "0 dependencies have forbidden licenses.\n1 dependency has dangerous licenses.",
      );

      expect(setOutputMock).toHaveBeenNthCalledWith(4, "valid", false);
      expect(setFailedMock).toHaveBeenNthCalledWith(
        1,
        "Some dependencies have not acceptable licenses.",
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
