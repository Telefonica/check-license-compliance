// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

import { configSchema } from "./lib/Config.types";
import { logLevelSchema } from "./lib/Logger.types";

export const reporterSchema = z.enum(["json", "markdown", "text"]).optional();
/** Formatter of the response */
export type Reporter = z.infer<typeof reporterSchema>;

export const allowWarningsSchema = z.boolean().optional();
/** Allow warnings */
export type AllowWarnings = z.infer<typeof allowWarningsSchema>;

export const inputOptionsSchema = z
  .object({
    log: logLevelSchema.optional(),
    reporter: reporterSchema.optional(),
    failOnNotValid: z.boolean().optional(),
  })
  .strict();

/** Input options */
export type InputOptions = z.infer<typeof inputOptionsSchema>;

export const allConfigSchema = z.object({
  ...configSchema.shape,
  ...inputOptionsSchema.shape,
});

/** All the configuration */
export type AllConfig = z.infer<typeof allConfigSchema>;
