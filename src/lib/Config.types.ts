// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import { logLevelSchema } from "./Logger.types";

export const allowedLicensesSchema = z.string().array();

/** List of allowed licenses */
export type AllowedLicenses = z.infer<typeof allowedLicensesSchema>;

export const warningLicensesSchema = z.string().array();

/** List of licenses that require special attention */
export type WarningLicenses = z.infer<typeof warningLicensesSchema>;

export const forbiddenLicensesSchema = z.string().array();

/** List of forbidden licenses */
export type ForbiddenLicenses = z.infer<typeof forbiddenLicensesSchema>;

export const licensesConfigSchema = z.object({
  allowed: allowedLicensesSchema.optional(),
  warning: warningLicensesSchema.optional(),
  forbidden: forbiddenLicensesSchema.optional(),
});

/** Configuration for licenses */
export type LicensesConfig = z.infer<typeof licensesConfigSchema>;

export const licenseCheckerConfigSchema = z.object({
  /** Exclude private packages or not */
  excludePrivatePackages: z.boolean().optional(),
  /** Only show production dependencies */
  production: z.boolean().optional(),
  /** Only show development dependencies */
  development: z.boolean().optional(),
  /** Path to start checking dependencies from */
  start: z.string().optional(),
  /** Show unknown licenses */
  unknown: z.boolean().optional(),
  /** Only list packages with unknown licenses */
  onlyUnknown: z.boolean().optional(),
  /** Exclude modules which licenses are in the comma-separated list from the output */
  exclude: z.boolean().optional(),
  /** Output the relative license path */
  relativeLicensePath: z.boolean().optional(),
  /** fail (exit with code 1) on the first occurrence of the licenses of the semicolon-separated list */
  failOn: z.string().optional(),
  /** fail (exit with code 1) on the first occurrence of the licenses not in the semicolon-separated list */
  onlyAllow: z.string().optional(),
  /** restrict output to the packages (package@version) in the semicolon-separated list */
  packages: z.string().optional(),
  /** restrict output to the packages (package@version) not in the semicolon-separated list */
  excludePackages: z.string().optional(),
  /** look for direct dependencies only */
  direct: z.boolean().optional(),
});

/** Options for license checker */
export type LicenseCheckerConfig = z.infer<typeof licenseCheckerConfigSchema>;

export const licenseCheckersOptionsSchema = z.object({
  /** Common options for all checks */
  global: licenseCheckerConfigSchema.optional(),
  /** Options for licenses that require special attention */
  warning: licenseCheckerConfigSchema.optional(),
  /** Options for forbidden licenses */
  forbidden: licenseCheckerConfigSchema.optional(),
});

/** Options for license checker at different groups */
export type LicenseCheckersOptions = z.infer<
  typeof licenseCheckersOptionsSchema
>;

export const configSchema = z
  .object({
    licenses: licensesConfigSchema,
    licenseCheckerOptions: licenseCheckersOptionsSchema.optional(),
    log: logLevelSchema.optional(),
  })
  .strict();

/** Options **/
export type Config = z.infer<typeof configSchema>;
