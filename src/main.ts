// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";

import { Checker } from "./lib/index.js";

import { getConfig } from "./Config.js";
import { getReport } from "./Report.js";

const FAILED_MESSAGE = "Some dependencies have not acceptable licenses.";
const OUTPUT_REPORT = "report";
const OUTPUT_VALID = "valid";
const FOUND_FORBIDDEN = "found-forbidden";
const FOUND_WARNING = "found-warning";

// TODO: Do not use github actions core library. Use Yargs to get the arguments.

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // NOTE: In github container actions, the workspace is mounted in /github/workspace
    // TODO: Expose a path option to allow the user to specify the path to execute the action inside the workspace
    const cwd = "/github/workspace";

    core.debug("Getting configuration...");
    const options = await getConfig(cwd);

    core.debug("Running checker...");
    const checker = new Checker({
      licenses: options.licenses,
      production: options.production,
      development: options.development,
      direct: options.direct,
      packages: options.packages,
      excludePackages: options.excludePackages,
      log: options.log,
      cwd,
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
