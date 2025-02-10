import semver from "semver";

import { ROOT_PATH } from "../Paths.js";
import type { System__Output as SystemOutput } from "../proto/deps_dev/v3/System";

import type {
  DependenciesReaderOptions,
  DependenciesReader,
  DependencyDeclaration,
  DependencyUniqueProps,
  DependencyId,
} from "./DependenciesReader.types";

const NODE_SYSTEM: SystemOutput = "NPM";

const SYSTEM_IDS = [NODE_SYSTEM];

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

/**
 * Base class for dependencies readers
 */
export class BaseSystemDependenciesReader implements DependenciesReader {
  protected _logger: DependenciesReaderOptions["logger"];
  protected cwd: string;

  constructor({ logger, cwd }: DependenciesReaderOptions) {
    this.cwd = cwd || ROOT_PATH;
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    throw new Error("Method not implemented.");
  }

  protected getVersionFromSemverRange(
    semverRange: string,
    packageName: string,
  ): string {
    try {
      const semverVersion = semver.minVersion(semverRange);
      const version = semverVersion ? semverVersion.toString() : semverRange;
      return version;
    } catch (error) {
      this._logger.error(
        `Error parsing semver range ${semverRange} of dependency ${packageName}`,
        error,
      );
      return semverRange;
    }
  }
}
