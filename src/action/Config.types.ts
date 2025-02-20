// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

import { configSchema } from "../lib/Config.types.js";
import { logLevelSchema } from "../lib/Logger.types.js";
import { reporterSchema } from "../lib/Reporter.types.js";

export const allowWarningsSchema = z.boolean().optional();
/** Allow warnings */
export type AllowWarnings = z.infer<typeof allowWarningsSchema>;

export const inputOptionsSchema = z
  .object({
    log: logLevelSchema.optional(),
    reporter: reporterSchema.optional(),
    failOnNotValid: z.boolean().optional(),
    path: z.string().optional(),
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
