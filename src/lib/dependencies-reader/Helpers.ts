import type { System__Output as SystemOutput } from "../proto/deps_dev/v3/System";

import type {
  DependencyUniqueProps,
  DependencyId,
} from "./DependenciesReader.types";

export const NPM_SYSTEM: SystemOutput = "NPM";

const SYSTEM_IDS = [NPM_SYSTEM];

export function getDependencyId(
  dependency: DependencyUniqueProps,
): DependencyId {
  return `${dependency.system}:${dependency.name}@${dependency.version}`;
}

export function removeSystemId(dependencyId: DependencyId): string {
  return SYSTEM_IDS.reduce((acc, system) => {
    return acc.replace(`${system}:`, "");
  }, dependencyId);
}

export function hasSystemId(dependencyId: DependencyId): boolean {
  return SYSTEM_IDS.some((system) => dependencyId.startsWith(`${system}:`));
}
