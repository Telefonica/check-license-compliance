// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

export const reporterSchema = z.enum(["json", "markdown", "text"]).optional();

/** Formatter of the response */
export type Reporter = z.infer<typeof reporterSchema>;
