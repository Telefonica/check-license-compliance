// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import semver from "semver";

import type {
  System,
  DependencyUniqueProps,
  DependencyId,
  SystemConfigKey,
} from "./DependenciesReader.types";

export const NPM_SYSTEM: System = "NPM";
export const MAVEN_SYSTEM: System = "MAVEN";
// cspell:disable-next-line
export const PYTHON_SYSTEM: System = "PYPI";
export const GO_SYSTEM: System = "GO";

const SYSTEM_IDS = [NPM_SYSTEM, MAVEN_SYSTEM, PYTHON_SYSTEM, GO_SYSTEM];

const NUMERIC_VERSION_REGEX = /^\d+(\.\d+)*(\S*)$/;

export const SYSTEM_CONFIGS_MAP: Record<System, SystemConfigKey> = {
  [NPM_SYSTEM]: "npm",
  [MAVEN_SYSTEM]: "maven",
  [PYTHON_SYSTEM]: "python",
  [GO_SYSTEM]: "go",
};

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

export function getDependencyDisplayName({
  id,
  version,
  resolvedVersion,
}: {
  id: string;
  version?: string;
  resolvedVersion?: string;
}): string {
  return resolvedVersion && resolvedVersion !== version
    ? `${id} (${resolvedVersion})`
    : id;
}

export function getDependencyName(
  dependency: Omit<DependencyUniqueProps, "version">,
): DependencyId {
  return `${dependency.system}:${dependency.name}`;
}

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

export function removeSystemId(dependencyId: DependencyId): string {
  return SYSTEM_IDS.reduce((acc, system) => {
    return acc.replace(`${system}:`, "");
  }, dependencyId);
}

export function hasSystemId(dependencyId: DependencyId): boolean {
  return SYSTEM_IDS.some((system) => dependencyId.startsWith(`${system}:`));
}

export function getDependencyNameAndVersionFromId(
  dependency: DependencyId,
): Omit<DependencyUniqueProps, "system"> {
  const dependencyWithoutSystem = removeSystemId(dependency);
  const lastAtIndex = dependencyWithoutSystem.lastIndexOf("@");
  const name = dependencyWithoutSystem.substring(0, lastAtIndex);
  const version = dependencyWithoutSystem.substring(lastAtIndex + 1);
  return { name, version };
}

function isValidStringVersion(version: string, system: System): boolean {
  if (!SYSTEM_VERSION_SETTINGS[system].validVersionRegex) {
    return false;
  }
  return SYSTEM_VERSION_SETTINGS[system].validVersionRegex.test(version);
}

export function isValidSemverVersion(version: string): boolean {
  return semver.valid(version) !== null;
}

export function isValidVersion(system: System, version?: string): boolean {
  if (!version) {
    return false;
  }
  return SYSTEM_VERSION_SETTINGS[system].useSemver
    ? isValidSemverVersion(version)
    : isValidStringVersion(version, system);
}

export function resolveVersion(
  system: System,
  version?: string,
): string | undefined {
  if (!version) {
    return version;
  }
  if (SYSTEM_VERSION_SETTINGS[system].useSemver) {
    const semverVersion = semver.minVersion(version);
    const result = semverVersion ? semverVersion.toString() : version;
    return result;
  }
  return version;
}
