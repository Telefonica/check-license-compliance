// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import type { CheckerConfig } from "./Config.types";
import type {
  System,
  SystemDependenciesOptions,
} from "./dependencies-reader/DependenciesReader.types";
import { SYSTEM_CONFIGS_MAP } from "./dependencies-reader/Helpers.js";

/**
 * Returns the configuration for a given system
 * @param system The system to get the configuration for
 * @param config The whole configuration object
 * @returns The configuration for the given system, or an empty object if it does not exist
 */
export function getSystemConfig(
  system: System,
  config: CheckerConfig,
): SystemDependenciesOptions {
  const systemOptions = config[SYSTEM_CONFIGS_MAP[system]];
  return systemOptions || {};
}
