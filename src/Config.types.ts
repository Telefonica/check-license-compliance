// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

import { configSchema } from "./lib/Config.types";

export const reporterSchema = z.enum(["json", "markdown", "text"]).optional();
/** Formatter of the response */
export type Reporter = z.infer<typeof reporterSchema>;

export const failOnForbiddenSchema = z.boolean().optional();
/** Fail on error */
export type FailOnForbidden = z.infer<typeof failOnForbiddenSchema>;

export const failOnWarningSchema = z.boolean().optional();
/** Fail on warning */
export type FailOnWarning = z.infer<typeof failOnWarningSchema>;

export const inputOptionsSchema = z
  .object({
    ...configSchema.shape,
    reporter: reporterSchema,
    failOnForbidden: failOnForbiddenSchema,
    failOnWarning: failOnWarningSchema,
  })
  .strict();

/** Input options */
export type InputOptions = z.infer<typeof inputOptionsSchema>;
