// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { createLogger } from "../../../../src/lib/Logger";

//@ts-expect-error partial mock
jest.mock<typeof import("winston")>("winston", () => ({
  createLogger: jest.fn().mockReturnValue({
    level: "info",
    info: jest.fn(),
    debug: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    colorize: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

describe("logger", () => {
  it("should log messages correctly", () => {
    const logger = createLogger("info");
    const logSpy = jest.spyOn(logger, "info");
    logger.info("Test message");

    expect(logSpy).toHaveBeenCalledWith("Test message");
  });

  it("should log debug messages correctly", () => {
    const logger = createLogger("debug");
    const logSpy = jest.spyOn(logger, "debug");
    logger.debug("Debug message");

    expect(logSpy).toHaveBeenCalledWith("Debug message");
  });

  it("should log warning messages correctly", () => {
    const logger = createLogger("warning");
    const logSpy = jest.spyOn(logger, "warning");
    logger.warning("Warning message");

    expect(logSpy).toHaveBeenCalledWith("Warning message");
  });

  it("should log error messages correctly", () => {
    const logger = createLogger("error");
    const logSpy = jest.spyOn(logger, "error");
    logger.error("Error message");

    expect(logSpy).toHaveBeenCalledWith("Error message");
  });
});
