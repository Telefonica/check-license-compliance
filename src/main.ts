// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";

import { getConfig } from "./Config";
import { Checker } from "./lib/index";

import { getReport } from "./Report";

const FAILED_MESSAGE = "Some dependencies have not acceptable licenses.";
const OUTPUT_REPORT = "report";
const OUTPUT_VALID = "valid";
const FOUND_FORBIDDEN = "found-forbidden";
const FOUND_WARNING = "found-warning";

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.debug("Getting configuration...");
    const options = await getConfig();

    core.debug("Running checker...");
    const checker = new Checker({
      licenses: options.licenses,
      licenseCheckerOptions: options.licenseCheckerOptions,
      log: options.log,
    });
    const result = await checker.check();

    const hasWarnings = result.warning.length > 0;
    const hasForbidden = result.forbidden.length > 0;

    core.setOutput(FOUND_FORBIDDEN, hasForbidden);
    core.setOutput(FOUND_WARNING, hasWarnings);

    const isValid = !(
      (hasWarnings && options.failOnWarning) ||
      (hasForbidden && options.failOnForbidden)
    );

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
