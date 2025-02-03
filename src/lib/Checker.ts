// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { Config, OtherLicenses } from "./Config.types";
import { LicenseCheckerResult, Result } from "./Checker.types";
import { createLogger } from "./Logger";

import { cwd } from "node:process";
import { init } from "license-checker";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import satisfies from "./spdx-satisfies/index";

const ROOT_DIR = cwd();

const UNKNOWN_LICENSE_IDENTIFIER = "UNKNOWN";
const CUSTOM_LICENSE_IDENTIFIER = "Custom: ";

/**
 * Check files for license headers
 */
export class Checker {
  private _logger: ReturnType<typeof createLogger>;
  private _config: Config;
  private _packages?: string;
  private _excludePackages?: string;
  private _others: OtherLicenses = "forbidden";
  private _unknown: OtherLicenses = "warning";

  /**
   * Create a new checker
   * @param options Options for the checker
   */
  constructor(config: Config) {
    this._logger = createLogger(config.log);
    this._config = config;
    this._logger.verbose("Checker created with config", config);

    if (config.packages) {
      this._packages = config.packages.join(";");
    }
    if (config.excludePackages) {
      this._excludePackages = config.excludePackages.join(";");
    }
    if (config.licenses?.others) {
      this._others = config.licenses.others;
    }
    if (config.licenses?.unknown) {
      this._unknown = config.licenses.unknown;
    }
  }

  /**
   * Returns an array of packages using a license that is not in the exclusions, or is unknown
   * @returns List of packages using a license that is not in the exclusions
   */
  private async _getLicensesExcluding(
    exclusions: string[],
  ): Promise<LicenseCheckerResult[]> {
    return new Promise((resolve, reject) => {
      init(
        {
          start: ROOT_DIR,
          // @ts-expect-error The library typing says that requires an array, but it only works with a comma-separated string
          exclude: exclusions.join(","),
          relativeLicensePath: true,
          packages: this._packages,
          excludePackages: this._excludePackages,
          production: this._config.production || false,
          development: this._config.development || false,
          direct: this._config.direct || false,
          excludePrivatePackages:
            this._config.excludePrivatePackages === false ? false : true,
          unknown: true,
        },
        (err, packages) => {
          if (err) {
            reject(err);
          } else {
            resolve(
              Object.entries(packages).map(([moduleName, result]) => {
                const licensesResult = result.licenses || [];
                return {
                  module: moduleName,
                  licenses:
                    typeof licensesResult === "string"
                      ? [licensesResult]
                      : licensesResult,
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
   * Determines if a license satisfies a list of license identifiers
   * @param license The license to check
   * @param licenseIdentifiers The license identifiers to check
   * @returns True if the license satisfies any of the license identifiers, false otherwise
   */
  private _licenseSatisfies(
    license: string,
    licenseIdentifiers: string[],
  ): boolean {
    if (licenseIdentifiers.length === 0) {
      return false;
    }
    this._logger.debug(
      `Checking if ${license} satisfies ${licenseIdentifiers}`,
    );
    return licenseIdentifiers.some((licenseIdentifier) => {
      try {
        if (satisfies(license, [licenseIdentifier])) {
          this._logger.debug(`${license} satisfies ${licenseIdentifier}.`);
          return true;
        }
        this._logger.debug(`${license} does not satisfy ${licenseIdentifier}.`);
        return false;
      } catch {
        this._logger.debug(
          `Error checking if license ${license} satisfies ${licenseIdentifier} using SPDX. It is${license !== licenseIdentifier ? " not" : ""} equal using a string comparison.`,
        );
        // Fallback to a simple string comparison in case the SPDX identifier is not valid
        return licenseIdentifier === license;
      }
    });
  }

  /**
   * Determines if the licenses are allowed according to the configuration
   * @param licenses The licenses to check
   * @returns True if the licenses are allowed, false otherwise
   */
  private _isAllowed(licenses: string[]): boolean {
    const result = licenses.some((license) =>
      this._licenseSatisfies(license, this._config.licenses?.allowed || []),
    );
    this._logger.verbose("Checking if licenses are allowed", {
      licenses,
      result,
    });
    return result;
  }

  /**
   * Determines if the licenses are forbidden according to the configuration
   * @param licenses The licenses to check
   * @returns True if the licenses are forbidden, false otherwise
   */
  private _isForbidden(licenses: string[]): boolean {
    const result = licenses.some((license) =>
      this._licenseSatisfies(license, this._config.licenses?.forbidden || []),
    );
    this._logger.verbose("Checking if licenses are forbidden", {
      licenses,
      result,
    });
    return result;
  }

  /**
   * Determines if the licenses are warning according to the configuration
   * @param licenses The licenses to check
   * @returns True if the licenses are warning, false otherwise
   */
  private _isWarning(licenses: string[]): boolean {
    const result = licenses.some((license) =>
      this._licenseSatisfies(license, this._config.licenses?.warning || []),
    );
    this._logger.verbose("Checking if licenses are warning", {
      licenses,
      result,
    });
    return result;
  }

  /**
   * Determines if the licenses are unknown
   * @param licenses The licenses to check
   * @returns True if the licenses are unknown, false otherwise
   */
  private _isUnknown(licenses: string[]): boolean {
    const result = licenses.some(
      (license) => license === UNKNOWN_LICENSE_IDENTIFIER,
    );
    this._logger.verbose("Checking if licenses are unknown", {
      licenses,
      result,
    });
    return result;
  }

  /**
   * Replaces custom license identifier with the UNKNOWN identifier, because the license-checker library returns "Custom: repo-url" when it cannot find a valid SPDX license identifier
   * @param license The license to replace
   * @returns UNKNOWN if the license is a custom identifier, the license otherwise
   */
  private _replaceCustomLicenseIdentifier(license: string): string {
    if (license.startsWith(CUSTOM_LICENSE_IDENTIFIER)) {
      return UNKNOWN_LICENSE_IDENTIFIER;
    }
    return license;
  }

  /**
   * Replaces custom license identifiers with the UNKNOWN identifier, because the license-checker library returns "Custom: repo-url" when it cannot find a valid SPDX license identifier
   * @param licenses The licenses to replace
   * @returns Licenses with custom identifiers replaced
   */
  private _replaceCustomLicenseIdentifiers(
    licenses: LicenseCheckerResult[],
  ): LicenseCheckerResult[] {
    return licenses.map((moduleData) => {
      return {
        ...moduleData,
        licenses: !moduleData.licenses.length
          ? [UNKNOWN_LICENSE_IDENTIFIER]
          : moduleData.licenses.map(this._replaceCustomLicenseIdentifier),
      };
    });
  }

  /**
   * Checks all rules
   * @returns An object with the result of the check
   */
  public async check(): Promise<Result> {
    this._logger.info("Checking Node.js licenses");
    const notExplicitlyAllowedLicenses = this._replaceCustomLicenseIdentifiers(
      await this._getLicensesExcluding([
        ...(this._config.licenses?.allowed || []),
      ]),
    );

    let forbidden: LicenseCheckerResult[] = [];
    let warning: LicenseCheckerResult[] = [];
    let unknown: LicenseCheckerResult[] = [];
    let others: LicenseCheckerResult[] = [];

    this._logger.debug("Licenses to consider as warning", {
      licenses: this._config.licenses?.warning || [],
    });
    this._logger.debug("Licenses to consider as forbidden", {
      licenses: this._config.licenses?.forbidden || [],
    });

    this._logger.debug("Licenses not explicitly allowed", {
      licenses: notExplicitlyAllowedLicenses,
    });

    notExplicitlyAllowedLicenses.forEach((moduleData) => {
      const licenses = moduleData.licenses;

      // NOTE: Even when we exclude allowed licenses in the search, we check them again in order to provide support for custom license identifiers
      if (this._isAllowed(licenses)) {
        return;
      }

      if (this._isForbidden(licenses)) {
        forbidden.push(moduleData);
      } else if (this._isWarning(licenses)) {
        warning.push(moduleData);
      } else if (this._isUnknown(licenses)) {
        unknown.push(moduleData);
      } else {
        others.push(moduleData);
      }
    });

    if (this._others === "warning") {
      this._logger.verbose(
        "Adding others as warning according to the configuration",
      );
      warning = warning.concat(others);
    } else {
      this._logger.verbose(
        "Adding others as forbidden according to the configuration",
      );
      forbidden = forbidden.concat(others);
    }

    if (this._unknown === "warning") {
      this._logger.verbose(
        "Adding unknown as warning according to the configuration",
      );
      warning = warning.concat(unknown);
    } else {
      this._logger.verbose(
        "Adding unknown as forbidden according to the configuration",
      );
      forbidden = forbidden.concat(unknown);
    }

    return { forbidden, warning };
  }
}
