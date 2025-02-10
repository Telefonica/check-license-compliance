import globule from "globule";
import semver from "semver";

import { ROOT_PATH } from "../Paths.js";
import type { System__Output as SystemOutput } from "../proto/deps_dev/v3/System";

import type {
  DependenciesReaderOptions,
  DependenciesReader,
  DependencyDeclaration,
  DependencyUniqueProps,
  DependencyId,
  SystemDependenciesReaderOptions,
  SystemDependenciesOptions,
  BaseSystemDependenciesReaderOptions,
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
export class BaseSystemDependenciesReader<T extends SystemDependenciesOptions>
  implements DependenciesReader
{
  protected logger: DependenciesReaderOptions["logger"];
  protected cwd: string;
  protected options: T;
  protected system: SystemOutput;
  private _defaultInclude: string[];
  private _defaultExclude: string[];

  constructor(
    { logger, cwd, options }: SystemDependenciesReaderOptions<T>,
    {
      defaultInclude,
      defaultExclude,
      system,
    }: BaseSystemDependenciesReaderOptions,
  ) {
    this.system = system;
    this.cwd = cwd || ROOT_PATH;
    this.options = options || ({} as T);
    this.logger = logger;
    this._defaultExclude = defaultExclude || [];
    if (!defaultInclude) {
      throw new Error(
        "defaultInclude is required for system dependencies reader",
      );
    }
    this._defaultInclude = defaultInclude;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    throw new Error("Method not implemented.");
  }

  /**
   * Returns a list of files to read, relative to the cwd
   * @returns List of files to read
   */
  protected findFiles(): string[] {
    const includeFiles = this.options.includeFiles || this._defaultInclude;
    const excludeFiles = this.options.excludeFiles || this._defaultExclude;
    this.logger.debug(`Finding files to read for ${this.system} dependencies`, {
      includeFiles,
      excludeFiles,
    });
    return globule.find(includeFiles, {
      ignore: excludeFiles,
      cwd: this.cwd,
    });
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
      this.logger.error(
        `Error parsing semver range ${semverRange} of dependency ${packageName}`,
        error,
      );
      return semverRange;
    }
  }
}
