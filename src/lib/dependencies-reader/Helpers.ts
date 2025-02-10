import semver from "semver";

import type {
  System,
  DependencyUniqueProps,
  DependencyDeclarationUniqueProps,
  DependencyId,
} from "./DependenciesReader.types";

export const NPM_SYSTEM: System = "NPM";
export const MAVEN_SYSTEM: System = "MAVEN";
// cspell:disable-next-line
export const PYTHON_SYSTEM: System = "PYPI";
export const GO_SYSTEM: System = "GO";

const SYSTEM_IDS = [NPM_SYSTEM, MAVEN_SYSTEM, PYTHON_SYSTEM, GO_SYSTEM];

const SYSTEM_VERSION_SETTINGS: Record<System, { useSemver: boolean }> = {
  [NPM_SYSTEM]: {
    useSemver: true,
  },
  [MAVEN_SYSTEM]: {
    useSemver: false,
  },
  [PYTHON_SYSTEM]: {
    useSemver: true,
  },
  [GO_SYSTEM]: {
    useSemver: true,
  },
};

export function getDependencyName(
  dependency: Omit<DependencyUniqueProps, "version">,
): DependencyId {
  return `${dependency.system}:${dependency.name}`;
}

export function getDependencyId({
  system,
  name,
  version,
}: DependencyDeclarationUniqueProps): DependencyId {
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

function isValidStringVersion(version: string): boolean {
  // Check if version is a range of numbers and dots, continued by any other string
  return /^\d+(\.\d+)*(\S*)$/.test(version);
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
    : isValidStringVersion(version);
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
