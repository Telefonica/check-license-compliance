// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";

import { getConfig } from "../../../../src/action/Config";
import { run } from "../../../../src/action/index";
import { Checker, getReport } from "../../../../src/lib";
import type { Result } from "../../../../src/lib/Checker.types";

jest.mock("@actions/core");
jest.mock("../../../../src/lib");
jest.mock("../../../../src/action/Config");

const coreMock = core as jest.Mocked<typeof core>;
const getConfigMock = jest.mocked(getConfig);
const CheckerMock = jest.mocked(Checker);
const getReportMock = jest.mocked(getReport);

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
    getConfigMock.mockResolvedValue({
      reporter: "text",
      log: "info",
      failOnNotValid: true,
      cwd: "/github/workspace",
    });
    CheckerMock.prototype.check.mockResolvedValue(mockResult);
    getReportMock.mockReturnValue("Mocked report");
  });

  it("should set outputs correctly when there are no forbidden or warning licenses", async () => {
    await run();

    expect(coreMock.setOutput).toHaveBeenCalledWith("found-forbidden", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith("found-warning", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith("report", "Mocked report");
    expect(coreMock.setOutput).toHaveBeenCalledWith("valid", true);
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });

  it("should set outputs correctly when there are forbidden licenses", async () => {
    CheckerMock.prototype.check.mockResolvedValueOnce({
      ...mockResult,
      forbidden: [
        {
          module: "forbidden-module",
          licenses: [],
          direct: true,
          origins: [],
          ancestors: [],
        },
      ],
    });

    await run();

    expect(coreMock.setOutput).toHaveBeenCalledWith("found-forbidden", true);
    expect(coreMock.setOutput).toHaveBeenCalledWith("found-warning", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith("report", "Mocked report");
    expect(coreMock.setOutput).toHaveBeenCalledWith("valid", false);
    expect(coreMock.setFailed).toHaveBeenCalledWith(
      "Some dependencies have not acceptable licenses.",
    );
  });

  it("should set outputs correctly when there are warning licenses", async () => {
    CheckerMock.prototype.check.mockResolvedValueOnce({
      ...mockResult,
      warning: [
        {
          module: "warning-module",
          licenses: [],
          direct: true,
          origins: [],
          ancestors: [],
        },
      ],
    });

    await run();

    expect(coreMock.setOutput).toHaveBeenCalledWith("found-forbidden", false);
    expect(coreMock.setOutput).toHaveBeenCalledWith("found-warning", true);
    expect(coreMock.setOutput).toHaveBeenCalledWith("report", "Mocked report");
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
