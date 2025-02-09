// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import { logLevelSchema } from "./Logger.types.js";

export const allowedLicensesSchema = z.string().array();

/** List of allowed licenses */
export type AllowedLicenses = z.infer<typeof allowedLicensesSchema>;

export const warningLicensesSchema = z.string().array();

/** List of licenses that require special attention */
export type WarningLicenses = z.infer<typeof warningLicensesSchema>;

export const forbiddenLicensesSchema = z.string().array();

/** List of forbidden licenses */
export type ForbiddenLicenses = z.infer<typeof forbiddenLicensesSchema>;

/** The result that licenses not included in allowed, warning or forbidden should produce */
export type OtherLicenses = "warning" | "forbidden";

/** The result that licenses not determined should produce */
export type UnknownLicenses = "warning" | "forbidden";

export const licensesConfigSchema = z.object({
  allowed: allowedLicensesSchema.optional(),
  warning: warningLicensesSchema.optional(),
  forbidden: forbiddenLicensesSchema.optional(),
  others: z.enum(["warning", "forbidden"]).optional(),
  unknown: z.enum(["warning", "forbidden"]).optional(),
});

/** Configuration for licenses */
export type LicensesConfig = z.infer<typeof licensesConfigSchema>;

/** Options schema */
export const configSchema = z
  .object({
    licenses: licensesConfigSchema.optional(),
    production: z.boolean().optional(),
    development: z.boolean().optional(),
    direct: z.boolean().optional(),
    packages: z.array(z.string()).optional(),
    excludePackages: z.array(z.string()).optional(),
    log: logLevelSchema.optional(),
    cwd: z.string().optional(),
  })
  .strict();

/** Options **/
export type Config = z.infer<typeof configSchema>;
