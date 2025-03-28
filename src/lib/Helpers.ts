import { getSystemConfig } from "./Config.js";
import type {
  ModuleSpec,
  OptionsBySystem,
} from "./dependencies-reader/DependenciesReader.types";
import {
  isString,
  hasSystemId,
  matchesDependencyModule,
  removeSystemId,
} from "./dependencies-reader/Helpers.js";
import type { DependencyBasicInfo } from "./DependenciesInfo.types";

/**
 * Determines if a module id is in a list. Ids can be passed with or without system id
 * @param moduleSpecs The list to check
 * @param moduleId The module id to check
 * @returns True if the module id is in the list, false otherwise
 */
export function moduleMatchSpecs(
  dependencyInfo: DependencyBasicInfo,
  moduleSpecs: ModuleSpec[],
  requireIgnored?: boolean,
): boolean {
  return moduleSpecs.some((spec) => {
    if (isString(spec)) {
      const specHasSystemId = hasSystemId(spec);
      if (specHasSystemId) {
        return spec === dependencyInfo.id;
      }
      return spec === removeSystemId(dependencyInfo.id);
    }
    return (
      matchesDependencyModule(dependencyInfo, spec) &&
      (!requireIgnored || spec.ignore === true)
    );
  });
}

export function dependencyIsExcludedOrIncluded(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
  type: "exclude" | "include",
  requireIgnored?: boolean,
): boolean {
  const systemConfig = getSystemConfig(dependency.system, config);
  const key = type === "exclude" ? "excludeModules" : "modules";
  if (systemConfig[key]) {
    return moduleMatchSpecs(dependency, systemConfig[key], requireIgnored);
  }
  return type === "exclude" ? false : true;
}

/**
 * Returns true if the dependency is in the list of modules to exclude according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsExcluded(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
): boolean {
  return dependencyIsExcludedOrIncluded(dependency, config, "exclude");
}

/**
 * Returns true if the dependency is in the list of modules to exclude according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsIncluded(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
): boolean {
  return dependencyIsExcludedOrIncluded(dependency, config, "include");
}

/**
 * Returns true if the dependency is in the list of modules to exclude and it is ignored according to the configuration of the dependency system
 * @param dependency The dependency to check
 * @returns True if the dependency is in the list of modules to exclude, false otherwise
 */
export function dependencyIsIgnored(
  dependency: DependencyBasicInfo,
  config: OptionsBySystem,
): boolean {
  return dependencyIsExcludedOrIncluded(dependency, config, "exclude", true);
}
