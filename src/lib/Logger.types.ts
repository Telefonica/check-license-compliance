// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

export const logLevelSchema = z.enum([
  "silly",
  "debug",
  "verbose",
  "info",
  "warning",
  "error",
]);

/** Possible log levels */
export type LogLevel = z.infer<typeof logLevelSchema>;
