// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from "url";

import fsExtra from "fs-extra";
import parseSpdx from "spdx-expression-parse";
import satisfies from "spdx-satisfies";

import type { LicensesResult, Result } from "./Checker.types";
import type { CheckerConfig, OtherLicenses } from "./Config.types";
import { hasSystemId, removeSystemId } from "./dependencies-reader/Helpers.js";
import { DependenciesInfo } from "./DependenciesInfo.js";
import { createLogger } from "./Logger.js";

/**
 * Check files for license headers
 */
export class Checker {
  private _logger: ReturnType<typeof createLogger>;
  private _config: CheckerConfig;
  private _others: OtherLicenses = "forbidden";
  private _unknown: OtherLicenses = "warning";
  private _dependenciesInfo: DependenciesInfo;
  private _production: boolean;
  private _development: boolean;
  private _spdxIds!: string[];

  /**
   * Create a new checker
   * @param options Options for the checker
   */
  constructor(config: CheckerConfig) {
    this._logger = createLogger(config.log);
    this._config = config;
    this._logger.verbose("Checker created with config", config);
    this._production = config.production || true;
    this._development = config.development || true;

    if (config.licenses?.others) {
      this._others = config.licenses.others;
    }
    if (config.licenses?.unknown) {
      this._unknown = config.licenses.unknown;
    }
    this._dependenciesInfo = new DependenciesInfo({
      cwd: config.cwd,
      logger: this._logger,
    });
  }

  private _initialize = async () => {
    const spdxIdsPath = import.meta.resolve("spdx-license-ids");

    this._spdxIds = await fsExtra.readJson(fileURLToPath(spdxIdsPath));
  };

  private _isValidSpdx(license: string): boolean {
    if (this._spdxIds.includes(license)) {
      return true;
    }
    try {
      parseSpdx(license);
      return true;
    } catch {
      return false;
    }
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
    const licenseIsValidSpdx = this._isValidSpdx(license);

    return licenseIdentifiers.some((licenseIdentifier) => {
      const identifierIsValidSpdx = this._spdxIds.includes(licenseIdentifier);
      if (licenseIsValidSpdx && identifierIsValidSpdx) {
        this._logger.silly(
          `Checking if "${license}" satisfies "${licenseIdentifier}" using spdx-satisfies`,
        );
        //@ts-expect-error Types library is not updated. From 6.0 version it supports passing an array of licenses
        if (satisfies(license, [licenseIdentifier])) {
          this._logger.verbose(`${license} satisfies ${licenseIdentifier}.`);
          return true;
        }
        this._logger.verbose(
          `${license} does not satisfy ${licenseIdentifier}.`,
        );
        return false;
      }
      if (!licenseIsValidSpdx) {
        this._logger.silly(
          `License "${licenseIdentifier}" from a dependency is not a valid SPDX expression. Using a string comparison to check it.`,
        );
      }
      if (!identifierIsValidSpdx) {
        this._logger.warn(
          `License identifier "${licenseIdentifier}" from config is not a valid SPDX identifier. Using a string comparison to check it.`,
        );
      }
      const licenseIsEqual = license === licenseIdentifier;
      if (licenseIsEqual) {
        this._logger.verbose(`${license} satisfies ${licenseIdentifier}.`);
        return true;
      }
      this._logger.verbose(`${license} does not satisfy ${licenseIdentifier}.`);
      return false;
    });
  }

  private _allLicensesSatisfies(
    licenses: string[],
    licenseIdentifiers: string[],
  ): boolean {
    return licenses.every((license) =>
      this._licenseSatisfies(license, licenseIdentifiers),
    );
  }

  private _packageIdIsInList(list: string[], packageId: string): boolean {
    return list.some((id) => {
      const idHasSystem = hasSystemId(id);
      if (idHasSystem) {
        return id === packageId;
      }
      return id === removeSystemId(packageId);
    });
  }

  /**
   * Returns an array of packages using a license that is not in the exclusions, or is unknown
   * @returns List of packages using a license that is not in the exclusions
   */
  private async _getLicensesToCheck(): Promise<LicensesResult[]> {
    const dependencies = await this._dependenciesInfo.getDependencies();

    this._logger.info("Checking licenses");

    return dependencies
      .filter((dependency) => {
        if (
          this._config.packages &&
          !this._packageIdIsInList(this._config.packages, dependency.id)
        ) {
          this._logger.debug(
            `Excluding dependency ${dependency.id} because it is not in the list of packages to check`,
          );
          return false;
        }
        if (
          this._config.excludePackages &&
          this._packageIdIsInList(this._config.excludePackages, dependency.id)
        ) {
          this._logger.debug(
            `Excluding dependency ${dependency.id} because it is in the list of packages to exclude`,
          );
          return false;
        }

        if (
          dependency.development &&
          !this._development &&
          (!dependency.production || !this._config.production)
        ) {
          this._logger.debug(
            `Excluding development dependency ${dependency.id}`,
          );
          return false;
        }

        if (
          dependency.production &&
          !this._production &&
          (!dependency.development || !this._config.development)
        ) {
          this._logger.debug(
            `Excluding production dependency ${dependency.id}`,
          );
          return false;
        }

        if (!dependency.direct && this._config.direct) {
          this._logger.debug(`Excluding indirect dependency ${dependency.id}`);
          return false;
        }
        return true;
      })
      .map((dependency) => {
        return {
          module: dependency.id,
          licenses: dependency.licenses,
          origins: dependency.origins,
          ancestors: dependency.ancestors,
          direct: dependency.direct,
        };
      });
  }

  /**
   * Determines if the licenses are allowed according to the configuration
   * @param licenses The licenses to check
   * @returns True if the licenses are allowed, false otherwise
   */
  private _isAllowed(licenses: string[]): boolean {
    const result = this._allLicensesSatisfies(
      licenses,
      this._config.licenses?.allowed || [],
    );

    this._logger.verbose("Checked if licenses are allowed", {
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
    const result = this._allLicensesSatisfies(
      licenses,
      this._config.licenses?.forbidden || [],
    );
    this._logger.verbose("Checked if licenses are forbidden", {
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
    const result = this._allLicensesSatisfies(
      licenses,
      this._config.licenses?.warning || [],
    );
    this._logger.verbose("Checked if licenses are warning", {
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
    return licenses.length === 0;
  }

  /**
   * Checks all rules
   * @returns An object with the result of the check
   */
  public async check(): Promise<Result> {
    await this._initialize();
    const licensesToCheck = await this._getLicensesToCheck();

    this._logger.debug("Licenses to check", {
      licenses: licensesToCheck,
    });

    let forbidden: LicensesResult[] = [];
    let warning: LicensesResult[] = [];
    let unknown: LicensesResult[] = [];
    let others: LicensesResult[] = [];

    this._logger.debug("Licenses to consider as allowed", {
      licenses: this._config.licenses?.allowed || [],
    });
    this._logger.debug("Licenses to consider as warning", {
      licenses: this._config.licenses?.warning || [],
    });
    this._logger.debug("Licenses to consider as forbidden", {
      licenses: this._config.licenses?.forbidden || [],
    });

    licensesToCheck.forEach((moduleData) => {
      const licenses = moduleData.licenses;

      // NOTE: Even when we exclude allowed licenses in the search, we check them again in order to provide support for custom license identifiers

      if (this._isUnknown(licenses)) {
        this._logger.warn(
          `No licenses info found for ${moduleData.module}. Adding it to "unknown"`,
        );
        unknown.push({
          ...moduleData,
          licenses: ["unknown"],
        });
      } else if (this._isAllowed(licenses)) {
        this._logger.verbose(
          `Licenses of ${moduleData.module} are allowed explicitly`,
        );
        return;
      } else if (this._isForbidden(licenses)) {
        this._logger.verbose(
          `Licenses of ${moduleData.module} are forbidden explicitly`,
        );
        forbidden.push(moduleData);
      } else if (this._isWarning(licenses)) {
        this._logger.verbose(
          `Licenses of ${moduleData.module} are warning explicitly`,
        );
        warning.push(moduleData);
      } else {
        this._logger.verbose(
          `Licenses of ${moduleData.module} are not explicitly allowed, forbidden or warning. Adding it to "others"`,
        );
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

    const caveats = {
      errors: this._dependenciesInfo.errors,
      warnings: this._dependenciesInfo.warnings,
    };

    this._logger.debug("Result", { forbidden, warning, caveats });

    return { forbidden, warning, caveats };
  }
}
