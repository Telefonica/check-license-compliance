// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { Config, LicenseCheckerConfig } from "./Config.types";
import { LicenseCheckerResult, Result } from "./Checker.types";
import { createLogger } from "./Logger";

import { cwd } from "node:process";
import licenseChecker from "license-checker";

const ROOT_DIR = cwd();

/**
 * Check files for license headers
 */
export class Checker {
  private _logger: ReturnType<typeof createLogger>;
  private _config: Config;

  /**
   * Create a new checker
   * @param options Options for the checker
   */
  constructor(config: Config) {
    this._logger = createLogger(config.log);
    this._config = config;
    this._logger.verbose("Checker created with config", config);
  }

  /**
   * Get the logger
   */
  public get logger() {
    return this._logger;
  }

  /**
   * Returns an array of packages using a license that is not in the exclusions, or is unknown
   * @returns List of packages using a license that is not in the exclusions
   */
  private async _checkLicensesExcluding(
    exclusions: string[],
    licenseCheckerOptions: LicenseCheckerConfig,
  ): Promise<LicenseCheckerResult[]> {
    return new Promise((resolve, reject) => {
      licenseChecker.init(
        {
          start: ROOT_DIR,
          // @ts-expect-error The library typing says that requires an array, but it only works with a comma-separated string
          exclude: exclusions.join(","),
          relativeLicensePath: true,
          ...licenseCheckerOptions,
        },
        (err, packages) => {
          if (err) {
            reject(err);
          } else {
            resolve(
              Object.entries(packages).map(([moduleName, result]) => {
                return {
                  module: moduleName,
                  licenses: result.licenses || [],
                  repository: result.repository || "",
                  publisher: result.publisher || "",
                  email: result.email || "",
                  path: result.path || "",
                  licenseFile: result.licenseFile || "",
                };
              }),
            );
          }
        },
      );
    });
  }

  /**
   * Returns an array of modules using a forbidden license
   * @returns Array of modules with forbidden licenses
   */
  private _checkForbiddenLicenses(): Promise<LicenseCheckerResult[]> {
    return this._checkLicensesExcluding(
      [
        ...(this._config.licenses?.allowed || []),
        ...(this._config.licenses?.warning || []),
      ],
      {
        ...this._config.licenseCheckerOptions?.global,
        ...this._config.licenseCheckerOptions?.forbidden,
      },
    );
  }

  /**
   * Returns an array of modules using licenses that require special attention
   * @returns Array of modules with licenses that require special attention
   */
  private _checkWarningLicenses(): Promise<LicenseCheckerResult[]> {
    return this._checkLicensesExcluding(
      [
        ...(this._config.licenses?.allowed || []),
        ...(this._config.licenses?.forbidden || []),
      ],
      {
        unknown: true,
        ...this._config.licenseCheckerOptions?.global,
        ...this._config.licenseCheckerOptions?.warning,
      },
    );
  }

  /**
   * Checks all rules
   * @returns An object with the result of the check
   */
  public async check(): Promise<Result> {
    this._logger.info("Checking Node.js licenses");
    const forbidden = await this._checkForbiddenLicenses();
    const warnings = await this._checkWarningLicenses();
    const warningsWithoutErrors = warnings.filter(
      (warning) =>
        !forbidden.some(
          (forbiddenModule) => forbiddenModule.module === warning.module,
        ),
    );
    return { forbidden, warning: warningsWithoutErrors };
  }
}
