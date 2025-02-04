// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

/** License checker result for one module */
export interface LicenseCheckerResult {
  /** The module name */
  module: string;
  /** The licenses used by the module */
  licenses: string[];
  /** The repository URL */
  repository: string;
  /** The publisher of the module */
  publisher: string;
  /** The email of the publisher */
  email: string;
  /** The path to the module */
  licenseFile: string;
}

/** Check licenses result */
export interface Result {
  /** Modules using forbidden licenses */
  forbidden: LicenseCheckerResult[];
  /**  Modules using licenses that require special attention */
  warning: LicenseCheckerResult[];
}
