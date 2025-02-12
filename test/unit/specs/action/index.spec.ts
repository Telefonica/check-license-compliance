// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";

import { getConfig } from "../../../../src/action/Config";
import { run } from "../../../../src/action/index";
import { Checker } from "../../../../src/lib";
import type { Result, LicensesResult } from "../../../../src/lib/Checker.types";

jest.mock("@actions/core");
jest.mock("../../../../src/lib");
jest.mock("../../../../src/action/Config");

const coreMock = core as jest.Mocked<typeof core>;
const getConfigMock = jest.mocked(getConfig);
const CheckerMock = jest.mocked(Checker);

const mockConfig = {
  log: "info" as const,
  failOnNotValid: true,
  reporter: "text" as const,
  cwd: "/github/workspace",
};

const mockResult: Result = {
  forbidden: [],
  warning: [],
  allowed: [],
  caveats: {
    errors: [],
    warnings: [],
  },
};

describe("run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getConfigMock.mockResolvedValue(mockConfig);
    CheckerMock.prototype.check.mockResolvedValue(mockResult);
  });

  it("should set outputs correctly when there are no forbidden or warning licenses", async () => {
    await run();

    expect(coreMock.setOutput).toHaveBeenCalledWith("found-forbidden", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith("found-warning", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "report",
      expect.any(String),
    );
    expect(coreMock.setOutput).toHaveBeenCalledWith("valid", true);
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("should set outputs correctly when there are forbidden licenses", async () => {
    const mockLicense: LicensesResult = {
      module: "forbidden-module",
      licenses: [],
      direct: true,
      origins: [],
      ancestors: [],
    };

    CheckerMock.prototype.check.mockResolvedValueOnce({
      ...mockResult,
      forbidden: [mockLicense],
    });

    await run();

    expect(coreMock.setOutput).toHaveBeenCalledWith("found-forbidden", true);
    expect(coreMock.setOutput).toHaveBeenCalledWith("found-warning", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "report",
      expect.any(String),
    );
    expect(coreMock.setOutput).toHaveBeenCalledWith("valid", false);
    expect(coreMock.setFailed).toHaveBeenCalledWith(
      "Some dependencies have not acceptable licenses.",
    );
  });

  it("should set outputs correctly when there are warning licenses", async () => {
    const mockLicense: LicensesResult = {
      module: "warning-module",
      licenses: [],
      direct: true,
      origins: [],
      ancestors: [],
    };

    CheckerMock.prototype.check.mockResolvedValueOnce({
      ...mockResult,
      warning: [mockLicense],
    });

    await run();

    expect(coreMock.setOutput).toHaveBeenCalledWith("found-forbidden", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith("found-warning", true);
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "report",
      expect.any(String),
    );
    expect(coreMock.setOutput).toHaveBeenCalledWith("valid", true);
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("should handle errors and set the action as failed", async () => {
    const error = new Error("Test error");
    getConfigMock.mockRejectedValueOnce(error);

    await run();

    expect(coreMock.error).toHaveBeenCalledWith(error);
    expect(coreMock.setFailed).toHaveBeenCalledWith(error.message);
  });
});
