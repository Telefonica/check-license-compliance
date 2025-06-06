// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

/** Licenses result for one module */
export interface LicensesResult {
  /** The module name and version */
  module: string;
  /** The original version of the module */
  version?: string;
  /** The version of the module used to get information when version is not defined locally */
  resolvedVersion?: string;
  /** The licenses used by the module */
  licenses: string[];
  /** If the module is a direct dependency of the project */
  direct: boolean;
  /** The file paths where the direct dependency of this module is defined */
  origins: string[];
  /** The ancestors */
  ancestors: string[];
}

/** Check licenses result */
export interface Result {
  /** Modules using forbidden licenses */
  forbidden: LicensesResult[];
  /**  Modules using licenses that require special attention */
  warning: LicensesResult[];
  /** Modules using licenses that are allowed */
  allowed: LicensesResult[];

  /** Contains information about problems that happened while retrieving modules info. This may imply some errors in the dependencies graph, like not detecting correctly whether a module is a production or development dependency, etc. */
  caveats: {
    errors: Error[];
    warnings: string[];
  };
}
