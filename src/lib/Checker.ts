// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { fileURLToPath } from "url";

import fsExtra from "fs-extra";
import parseSpdx from "spdx-expression-parse";
import satisfies from "spdx-satisfies";

import type { LicensesResult, Result } from "./Checker.types";
import type { CheckerConfig, OtherLicenses } from "./Config.types";
import { DependenciesInfo } from "./DependenciesInfo.js";
import { dependencyIsExcluded, dependencyIsIncluded } from "./Helpers.js";
import { createLogger } from "./Logger.js";
import { SPDX_LICENSE_IDS_PATH } from "./Paths.js";

function valueOrTrueIfUndefined(value?: boolean): boolean {
  return value !== undefined ? value : true;
}

const FORBIDDEN = "forbidden";
const WARNING = "warning";
const UNKNOWN = "unknown";

/**
 * Reads the dependencies and checks if they comply with the licenses configuration
 */
export class Checker {
  private _logger: ReturnType<typeof createLogger>;
  private _config: CheckerConfig;
  private _others: OtherLicenses = FORBIDDEN;
  private _unknown: OtherLicenses = WARNING;
  private _dependenciesInfo: DependenciesInfo;
  private _production: boolean;
  private _onlyDirect: boolean;
  private _development: boolean;
  private _spdxIds!: string[];
  private _loggedInvalidSpdxFromConfig: string[] = [];

  /**
   * Create a new checker
   * @param options Options for the checker
   */
  constructor(config: CheckerConfig) {
    this._logger = createLogger(config.log);
    this._config = config;
    this._logger.verbose("Checker created with config", config);
    this._production = valueOrTrueIfUndefined(config.production);
    this._onlyDirect = config.onlyDirect || false;
    this._development = valueOrTrueIfUndefined(config.development);

    if (config.licenses?.others) {
      this._others = config.licenses.others;
    }
    if (config.licenses?.unknown) {
      this._unknown = config.licenses.unknown;
    }
    this._dependenciesInfo = new DependenciesInfo({
      cwd: config.cwd,
      logger: this._logger,
      npm: config.npm,
      maven: config.maven,
      go: config.go,
      python: config.python,
      onlyDirect: this._onlyDirect,
      production: this._production,
      development: this._development,
    });
  }

  /**
   * Logs a warning only once when a license identifier in the configuration is not a valid SPDX identifier
   * @param licenseIdentifier The license identifier to log
   */
  private _logInvalidSpdxInConfig(licenseIdentifier: string): void {
    if (!this._loggedInvalidSpdxFromConfig.includes(licenseIdentifier)) {
      this._loggedInvalidSpdxFromConfig.push(licenseIdentifier);
      this._logger.warn(
        `License identifier "${licenseIdentifier}" from config is not a valid SPDX identifier. Using a string comparison to check it.`,
      );
    }
  }

  /**
   * Initializes the checker
   */
  private _initialize = async () => {
    this._spdxIds = await fsExtra.readJson(
      fileURLToPath(SPDX_LICENSE_IDS_PATH),
    );
  };

  /**
   * Determines if a license is a valid SPDX identifier
   * @param license The license to check
   * @returns True if the license is a valid SPDX identifier, false otherwise
   */
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
   * Logs that a license satisfies a license identifier
   * @param license The license
   * @param licenseIdentifier The license identifier that is satisfied
   * @param moduleName The module name
   */
  private _logSatisfies(
    license: string,
    licenseIdentifier: string,
    moduleName: string,
  ): void {
    this._logger.silly(
      `"${license}" from "${moduleName}" satisfies "${licenseIdentifier}".`,
    );
  }

  /**
   * Logs that a license does not satisfy a license identifier
   * @param license The license
   * @param licenseIdentifier The license identifier that is not satisfied
   * @param moduleName The module name
   */
  private _logNotSatisfies(
    license: string,
    licenseIdentifier: string,
    moduleName: string,
  ): void {
    this._logger.silly(
      `"${license}" from "${moduleName}" does not satisfy "${licenseIdentifier}".`,
    );
  }

  /**
   * Determines if a license satisfies a list of license identifiers
   * @param license The license to check
   * @param licenseIdentifiers The license identifiers to check
   * @param moduleData The data of the module to which the license belongs to
   * @returns True if the license satisfies any of the license identifiers, false otherwise
   */
  private _licenseSatisfies(
    license: string,
    licenseIdentifiers: string[],
    moduleData: LicensesResult,
  ): boolean {
    if (licenseIdentifiers.length === 0) {
      return false;
    }
    this._logger.silly(
      `Checking if ${license} from ${moduleData.module} satisfies ${licenseIdentifiers}`,
    );
    const licenseIsValidSpdx = this._isValidSpdx(license);

    return licenseIdentifiers.some((licenseIdentifier) => {
      const identifierIsValidSpdx = this._spdxIds.includes(licenseIdentifier);
      if (licenseIsValidSpdx && identifierIsValidSpdx) {
        this._logger.silly(
          `Checking if "${license}" from "${moduleData.module}" satisfies "${licenseIdentifier}" using spdx-satisfies`,
        );
        //@ts-expect-error Types library is not updated. From 6.0 version it supports passing an array of licenses
        if (satisfies(license, [licenseIdentifier])) {
          this._logSatisfies(license, licenseIdentifier, moduleData.module);
          return true;
        }
        this._logNotSatisfies(license, licenseIdentifier, moduleData.module);
        return false;
      }
      if (!licenseIsValidSpdx) {
        this._logger.silly(
          `License "${licenseIdentifier}" from ${moduleData.module} is not a valid SPDX expression. Using a string comparison to check it.`,
        );
      }
      if (!identifierIsValidSpdx) {
        this._logInvalidSpdxInConfig(licenseIdentifier);
      }
      const licenseIsEqual = license === licenseIdentifier;
      if (licenseIsEqual) {
        this._logSatisfies(license, licenseIdentifier, moduleData.module);
        return true;
      }
      this._logNotSatisfies(license, licenseIdentifier, moduleData.module);
      return false;
    });
  }

  /**
   * Determines if all the licenses satisfy a list of license identifiers
   * @param licenses The licenses to check
   * @param licenseIdentifiers The license identifiers to check
   * @param moduleData The data of the module to which the licenses belong to
   * @returns True if all the licenses satisfy any of the license identifiers, false otherwise
   */
  private _allLicensesSatisfies(
    licenses: string[],
    licenseIdentifiers: string[],
    moduleData: LicensesResult,
  ): boolean {
    return licenses.every((license) =>
      this._licenseSatisfies(license, licenseIdentifiers, moduleData),
    );
  }

  /**
   * Read the project dependencies and returns an array of modules using a license that is not in the exclusions from configuration
   * @returns List of modules using a license that is not in the exclusions from configuration
   */
  private async _getLicensesToCheck(): Promise<LicensesResult[]> {
    const dependencies = await this._dependenciesInfo.getDependencies();

    this._logger.info("Filtering dependencies to check");

    return dependencies
      .filter((dependency) => {
        if (!dependencyIsIncluded(dependency, this._config)) {
          this._logger.verbose(
            `Excluding dependency ${dependency.id} because it is not in the list of modules to check`,
          );
          return false;
        }
        if (dependencyIsExcluded(dependency, this._config)) {
          this._logger.verbose(
            `Excluding dependency ${dependency.id} because it is in the list of modules to exclude`,
          );
          return false;
        }

        if (
          dependency.development &&
          !this._development &&
          (!dependency.production ||
            // The first one check is redundant, but it is here to make the condition more readable
            (dependency.production && !this._production))
        ) {
          this._logger.verbose(
            `Excluding development dependency ${dependency.id}`,
          );
          return false;
        }

        if (
          dependency.production &&
          !this._production &&
          !dependency.development
        ) {
          this._logger.verbose(
            `Excluding production dependency ${dependency.id}`,
          );
          return false;
        }

        if (!dependency.direct && this._onlyDirect) {
          this._logger.verbose(
            `Excluding indirect dependency ${dependency.id}`,
          );
          return false;
        }
        return true;
      })
      .map((dependency) => {
        return {
          module: dependency.id,
          version: dependency.version,
          resolvedVersion: dependency.resolvedVersion,
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
   * @param moduleData The data of the module to which the licenses belong to
   * @returns True if the licenses are allowed, false otherwise
   */
  private _isAllowed(licenses: string[], moduleData: LicensesResult): boolean {
    const result = this._allLicensesSatisfies(
      licenses,
      this._config.licenses?.allowed || [],
      moduleData,
    );

    this._logger.debug(
      `Checked if licenses of ${moduleData.module} are allowed`,
      {
        licenses,
        result,
      },
    );
    return result;
  }

  /**
   * Determines if the licenses are forbidden according to the configuration
   * @param licenses The licenses to check
   * @param moduleData The data of the module to which the licenses belong to
   * @returns True if the licenses are forbidden, false otherwise
   */
  private _isForbidden(
    licenses: string[],
    moduleData: LicensesResult,
  ): boolean {
    const result = this._allLicensesSatisfies(
      licenses,
      this._config.licenses?.forbidden || [],
      moduleData,
    );
    this._logger.debug(
      `Checked if licenses of ${moduleData.module} are forbidden`,
      {
        licenses,
        result,
      },
    );
    return result;
  }

  /**
   * Determines if the licenses are warning according to the configuration
   * @param licenses The licenses to check
   * @param moduleData The data of the module to which the licenses belong to
   * @returns True if the licenses are warning, false otherwise
   */
  private _isWarning(licenses: string[], moduleData: LicensesResult): boolean {
    const result = this._allLicensesSatisfies(
      licenses,
      this._config.licenses?.warning || [],
      moduleData,
    );
    this._logger.debug(
      `Checked if licenses of ${moduleData.module} are warning`,
      {
        licenses,
        result,
      },
    );
    return result;
  }

  /**
   * Determines if the licenses should be considered as unknown because they are empty
   * @param licenses The licenses to check
   * @returns True if the licenses are empty, false otherwise
   */
  private _isUnknown(licenses: string[]): boolean {
    return licenses.length === 0;
  }

  /**
   * Reads the dependencies and checks if they comply with the licenses configuration
   * @returns An object with the result of the check
   */
  public async check(): Promise<Result> {
    await this._initialize();

    const licensesToCheck = await this._getLicensesToCheck();

    this._logger.info(`Checking ${licensesToCheck.length} licenses`);

    this._logger.debug("Licenses to check", {
      licenses: licensesToCheck,
    });

    let allowed: LicensesResult[] = [];
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
          `No licenses info found for ${moduleData.module}. Adding it to "${UNKNOWN}"`,
        );
        unknown.push({
          ...moduleData,
          licenses: [UNKNOWN],
        });
      } else if (this._isAllowed(licenses, moduleData)) {
        this._logger.verbose(
          `Licenses ${licenses.join(",")} of ${moduleData.module} are allowed explicitly`,
        );
        allowed.push(moduleData);
      } else if (this._isForbidden(licenses, moduleData)) {
        this._logger.verbose(
          `Licenses ${licenses.join(",")} of ${moduleData.module} are forbidden explicitly`,
        );
        forbidden.push(moduleData);
      } else if (this._isWarning(licenses, moduleData)) {
        this._logger.verbose(
          `Licenses ${licenses.join(",")} of ${moduleData.module} are warning explicitly`,
        );
        warning.push(moduleData);
      } else {
        this._logger.verbose(
          `Licenses ${licenses.join(",")} of ${moduleData.module} are not explicitly allowed, forbidden or warning. Adding it to "others"`,
        );
        others.push(moduleData);
      }
    });

    if (this._others === WARNING) {
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

    if (this._unknown === WARNING) {
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

    this._logger.debug("Result", { forbidden, warning, allowed, caveats });

    this._logger.info(`Found ${allowed.length} allowed licenses`);
    this._logger.info(`Found ${warning.length} warning licenses`);
    this._logger.info(`Found ${forbidden.length} forbidden licenses`);

    return { forbidden, warning, allowed, caveats };
  }
}
