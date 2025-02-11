// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";

import { Checker, getReport } from "../lib/index.js";

import { getConfig } from "./Config.js";

const FAILED_MESSAGE = "Some dependencies have not acceptable licenses.";
const OUTPUT_REPORT = "report";
const OUTPUT_VALID = "valid";
const FOUND_FORBIDDEN = "found-forbidden";
const FOUND_WARNING = "found-warning";

const shutdown = (signal: string, exitCode: number) => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Cleaning up...`);
  process.exit(exitCode);
};

process.on("SIGINT", () => shutdown("SIGINT", 130));
process.on("SIGTERM", () => shutdown("SIGTERM", 143));

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.debug("Getting configuration...");
    // NOTE: In github container actions, the workspace is mounted in /github/workspace
    //const options = await getConfig("/github/workspace");
    const options = await getConfig(process.cwd());

    core.debug("Running checker...");
    const checker = new Checker({
      ...options,
    });
    const result = await checker.check();

    const hasWarnings = result.warning.length > 0;
    const hasForbidden = result.forbidden.length > 0;

    core.setOutput(FOUND_FORBIDDEN, hasForbidden);
    core.setOutput(FOUND_WARNING, hasWarnings);

    const isValid = !hasForbidden;

    const report = getReport(options.reporter, result, isValid);
    core.info(report);
    core.setOutput(OUTPUT_REPORT, report);
    core.setOutput(OUTPUT_VALID, isValid);

    if (!isValid && options.failOnNotValid) {
      core.setFailed(FAILED_MESSAGE);
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.error(error as Error);
    if (error instanceof Error) core.setFailed(error.message);
  }
}
