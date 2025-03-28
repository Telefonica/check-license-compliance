// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import { getSystemConfig } from "./Config.js";
import type {
  ModuleSpec,
  OptionsBySystem,
} from "./dependencies-reader/DependenciesReader.types";
import {
  isString,
  matchesDependencyModule,
} from "./dependencies-reader/Helpers.js";
import type { DependencyBasicInfo } from "./DependenciesInfo.types";

const EXCLUDE_KEY = "exclude";
const INCLUDE_KEY = "include";

/**
 * Determines if a module id is in a list. Ids can be passed with or without system id
 * @param moduleSpecs The list to check
 * @param moduleId The module id to check
 * @param requireIgnored Only match ignored modules
 * @returns True if the module id is in the list, false otherwise
 */
export function moduleMatchSpecs(
  dependencyInfo: DependencyBasicInfo,
  moduleSpecs: ModuleSpec[],
  requireIgnored?: boolean,
): boolean {
  return moduleSpecs.some((spec) => {
    return (
      matchesDependencyModule(dependencyInfo, spec) &&
      (!requireIgnored || (!isString(spec) && spec.ignore === true))
    );
  });
}

/**
 * Returns true if the dependency is in the list of modules to exclude or include according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @param config The configuration of the dependency system
 * @param type The type of list to check
 * @param requireIgnored Only match ignored modules
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsExcludedOrIncluded(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
  type: "exclude" | "include",
  requireIgnored?: boolean,
): boolean {
  const systemConfig = getSystemConfig(dependency.system, config);
  const key = type === EXCLUDE_KEY ? "excludeModules" : "modules";
  if (systemConfig[key]) {
    return moduleMatchSpecs(dependency, systemConfig[key], requireIgnored);
  }
  return type !== EXCLUDE_KEY;
}

/**
 * Returns true if the dependency is in the list of modules to exclude according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @param config The configuration of the dependency system
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsExcluded(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
): boolean {
  return dependencyIsExcludedOrIncluded(dependency, config, EXCLUDE_KEY);
}

/**
 * Returns true if the dependency is in the list of modules to exclude according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @param config The configuration of the dependency system
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsIncluded(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
): boolean {
  return dependencyIsExcludedOrIncluded(dependency, config, INCLUDE_KEY);
}

/**
 * Returns true if the dependency is in the list of modules to exclude and it is ignored according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @param config The configuration of the dependency system
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsIgnored(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
): boolean {
  return dependencyIsExcludedOrIncluded(dependency, config, EXCLUDE_KEY, true);
}
