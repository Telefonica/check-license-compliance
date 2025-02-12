// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

/**
 * The root path of the library
 */
export const ROOT_PATH = path.resolve(import.meta.dirname, "..", "..");

/**
 * The path to the SPDX license IDs file
 */
export const SPDX_LICENSE_IDS_PATH = import.meta.resolve("spdx-license-ids");
