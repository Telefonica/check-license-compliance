// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import semver from "semver";

import type { DependencyInfo } from "../DependenciesInfo.types.js";

import type {
  System,
  DependencyUniqueProps,
  DependencyId,
  SystemConfigKey,
  ModuleSpec,
} from "./DependenciesReader.types";

/** System identifier used in NPM dependencies */
export const NPM_SYSTEM: System = "NPM";
/** System identifier used in NPM dependencies */
export const MAVEN_SYSTEM: System = "MAVEN";
/** System identifier used in PYTHON dependencies */
export const PYTHON_SYSTEM: System = "PYPI"; // cspell:disable-line
/** System identifier used in GO dependencies */
export const GO_SYSTEM: System = "GO";

/** List of all available system identifiers */
export const SYSTEM_IDS = [NPM_SYSTEM, MAVEN_SYSTEM, PYTHON_SYSTEM, GO_SYSTEM];

/** Regular expression to validate a numeric version */
const NUMERIC_VERSION_REGEX = /^\d+(\.\d+)*(\S*)$/;

/** Map of system identifiers to system configuration keys */
export const SYSTEM_CONFIGS_MAP: Record<System, SystemConfigKey> = {
  [NPM_SYSTEM]: "npm",
  [MAVEN_SYSTEM]: "maven",
  [PYTHON_SYSTEM]: "python",
  [GO_SYSTEM]: "go",
};

/** Map containing configurations for each different system. Used when resolving versions */
const SYSTEM_VERSION_SETTINGS: Record<
  System,
  { useSemver: boolean; validVersionRegex?: RegExp }
> = {
  [NPM_SYSTEM]: {
    useSemver: true,
  },
  [MAVEN_SYSTEM]: {
    useSemver: false,
    validVersionRegex: NUMERIC_VERSION_REGEX,
  },
  [PYTHON_SYSTEM]: {
    useSemver: false,
    validVersionRegex: NUMERIC_VERSION_REGEX,
  },
  [GO_SYSTEM]: {
    useSemver: false,
    validVersionRegex: /^v\d+(\.\d+)*(\S*)$/,
  },
};

/**
 * Returns the display name for a dependency
 * @param options The options to create the display name
 * @returns An string identifying the dependency, including information about the resolved version
 */
export function getDependencyDisplayName({
  id,
  version,
  resolvedVersion,
}: {
  /** The id of the dependency */
  id: string;
  /** The version of the dependency */
  version?: string;
  /** The resolved version of the dependency */
  resolvedVersion?: string;
}): string {
  return resolvedVersion && resolvedVersion !== version
    ? `${id} (${resolvedVersion})`
    : id;
}

/**
 * Returns the name of a dependency, without the version
 * @param dependency The dependency data to get the name from
 * @returns An string containing the system and the name of the dependency
 */
export function getDependencyName(
  dependency: Omit<DependencyUniqueProps, "version">,
): DependencyId {
  return `${dependency.system}:${dependency.name}`;
}

/**
 * Returns the unique id for a dependency
 * @param dependencyData The dependency data to create the id from
 * @returns The unique id for the dependency, containing the system, name and version
 */
export function getDependencyId({
  system,
  name,
  version,
}: DependencyUniqueProps): DependencyId {
  const fullName = getDependencyName({
    system: system,
    name: name,
  });
  if (!version) {
    return fullName;
  }
  return `${fullName}@${version}`;
}

/**
 * Removes the system id from a dependency id
 * @param dependencyId The dependency id to remove the system id from
 * @returns The dependency id without the system id
 */
export function removeSystemId(dependencyId: DependencyId): string {
  return SYSTEM_IDS.reduce((acc, system) => {
    return acc.replace(`${system}:`, "");
  }, dependencyId);
}

/**
 * Returns true if a dependency id has a system id
 * @param dependencyId The dependency id to check
 * @returns True if the dependency id has a system id, false otherwise
 */
export function hasSystemId(dependencyId: DependencyId): boolean {
  return SYSTEM_IDS.some((system) => dependencyId.startsWith(`${system}:`));
}

/**
 * Returns the name and version of a dependency from its id
 * @param dependency The dependency id to get the name and version from
 * @returns The name and version of the dependency
 */
export function getDependencyNameAndVersionFromId(
  dependency: DependencyId,
): Omit<DependencyUniqueProps, "system"> {
  const dependencyWithoutSystem = removeSystemId(dependency);
  const lastAtIndex = dependencyWithoutSystem.lastIndexOf("@");
  const name = dependencyWithoutSystem.substring(0, lastAtIndex);
  const version = dependencyWithoutSystem.substring(lastAtIndex + 1);
  return { name, version };
}

/**
 * Returns true if a version is valid for a specific system
 * @param version The version to check
 * @param system The system to check the version for
 * @returns True if the version is valid, false otherwise
 */
function isValidStringVersion(version: string, system: System): boolean {
  if (!SYSTEM_VERSION_SETTINGS[system].validVersionRegex) {
    return false;
  }
  return SYSTEM_VERSION_SETTINGS[system].validVersionRegex.test(version);
}

/**
 * Returns true if a version is a valid semver version
 * @param version The version to check
 * @returns True if the version is a valid semver version, false otherwise
 */
export function isValidSemverVersion(version: string): boolean {
  return semver.valid(version) !== null;
}

/**
 * Returns true if a version is valid for a specific system
 * @param system The system to check the version for
 * @param version The version to check
 * @returns True if the version is valid, false otherwise
 */
export function isValidVersion(system: System, version?: string): boolean {
  if (!version) {
    return false;
  }
  return SYSTEM_VERSION_SETTINGS[system].useSemver
    ? isValidSemverVersion(version)
    : isValidStringVersion(version, system);
}

/**
 * Returns the resolved version of a dependency
 * In systems using Semver, like NPM, it will return the min version of a semver range.
 * In other systems, it will return the version as is
 * @param system The system where the dependency is defined
 * @param version The version of the dependency
 * @returns The resolved version of the dependency when the system uses Semver, or the version as is
 */
export function resolveVersion(
  system: System,
  version?: string,
): string | undefined {
  if (!version) {
    return version;
  }
  if (SYSTEM_VERSION_SETTINGS[system].useSemver) {
    // TODO: Get max version that satisfies the range from the versions available in the registry
    const semverVersion = semver.minVersion(version);
    const result = semverVersion ? semverVersion.toString() : version;
    return result;
  }
  return version;
}

/**
 * Checks if a value is a string
 * @param value The value to check
 * @returns True if the value is a string, false otherwise
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Checks if a dependency matches a module specification
 * @param dependency The dependency to check
 * @param moduleSpec The module specification
 * @returns True if the dependency matches the module specification
 */
export function matchesDependencyModule(
  dependency: DependencyInfo,
  moduleSpec: ModuleSpec,
): boolean {
  // Case 1: Simple string format "name@version"
  if (isString(moduleSpec)) {
    const { name: dependencyName, version: dependencyVersionFromId } =
      getDependencyNameAndVersionFromId(moduleSpec);
    const dependencyResolvedVersion =
      dependency.resolvedVersion || dependency.version;

    return (
      dependencyName === dependencyName &&
      (!dependencyVersionFromId ||
        !dependencyResolvedVersion ||
        dependencyResolvedVersion === dependencyVersionFromId)
    );
  }

  // Case 2: Object format
  const {
    name,
    version,
    semver: semverExpression,
    nameMatch,
    versionMatch,
  } = moduleSpec;

  // Match name (either exact match or regex pattern)
  let nameMatches = true;
  if (nameMatch) {
    const nameRegex = new RegExp(nameMatch);
    nameMatches = nameRegex.test(dependency.name);
  } else if (name) {
    nameMatches = dependency.name === name;
  }

  if (!nameMatches) return false;

  // Match version (exact match, regex pattern, or semver expression)
  let versionMatches = true;
  const dependencyVersion = dependency.resolvedVersion || dependency.version;

  if (!dependencyVersion) {
    return false;
  }

  if (versionMatch) {
    const versionRegex = new RegExp(versionMatch);
    versionMatches = versionRegex.test(dependencyVersion);
  } else if (semverExpression) {
    // Only run semver check if it's a valid semver version
    if (semver.valid(dependencyVersion)) {
      versionMatches = semver.satisfies(dependencyVersion, semverExpression);
    } else {
      // If not a valid semver, consider it doesn't match
      versionMatches = false;
    }
  } else if (version) {
    versionMatches = dependencyVersion === version;
  }

  return nameMatches && versionMatches;
}
