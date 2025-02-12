import globule from "globule";

import { ROOT_PATH } from "../Paths.js";

import type {
  DependenciesReaderOptions,
  DependenciesReader,
  DependencyDeclaration,
  DependencyUniqueProps,
  DependencyId,
  SystemDependenciesReaderOptions,
  SystemDependenciesOptions,
  BaseSystemDependenciesReaderOptions,
  System,
} from "./DependenciesReader.types";
import { resolveVersion } from "./Helpers.js";

const NODE_SYSTEM: System = "NPM";

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
  protected system: System;
  protected production: boolean;
  protected development: boolean;
  private _defaultInclude: string[];
  private _defaultExclude: string[];
  private _defaultDevelopment: string[];

  constructor(
    {
      logger,
      cwd,
      options,
      development,
      production,
    }: SystemDependenciesReaderOptions<T>,
    {
      defaultInclude,
      defaultExclude,
      defaultDevelopment,
      system,
    }: BaseSystemDependenciesReaderOptions,
  ) {
    this.system = system;
    this.cwd = cwd || ROOT_PATH;
    this.options = options || ({} as T);
    this.logger = logger;
    this.production = production;
    this.development = development;
    this._defaultExclude = defaultExclude || [];
    this._defaultDevelopment = defaultDevelopment || [];
    if (!defaultInclude) {
      throw new Error(
        "defaultInclude is required for system dependencies reader",
      );
    }
    this._defaultInclude = defaultInclude;
  }

  public async readFileDependencies(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _filePath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _isDevelopment?: boolean,
  ): Promise<DependencyDeclaration[]> {
    throw new Error(
      `Method readFileDependencies not implemented in system ${this.system}`,
    );
  }

  public async readDependencies(): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading ${this.system} dependencies`);

    const { dev, any } = this.findFiles();
    const dependencies = await Promise.all(
      any.map((goModPath) => this.readFileDependencies(goModPath)),
    );
    let devDependencies: DependencyDeclaration[] = [];
    if (this.development) {
      devDependencies = (
        await Promise.all(
          dev.map((filePath) => this.readFileDependencies(filePath, true)),
        )
      ).flat();
    } else {
      this.logger.warn(`Skipping read ${this.system} development dependencies`);
    }
    const flatDependencies = [...dependencies, ...devDependencies].flat();

    this.logger.info(
      `Found ${flatDependencies.length} ${this.system} direct dependencies in the project`,
    );
    this.logger.debug(`${this.system} dependencies`, {
      dependencies: flatDependencies,
    });

    return flatDependencies;
  }

  /**
   * Returns a list of files to read, relative to the cwd
   * @returns List of files to read, separated by files containing only development dependencies and files containing any type of dependencies
   */
  private findFiles(): {
    dev: string[];
    any: string[];
  } {
    const includeFiles = this.options.includeFiles || this._defaultInclude;
    const excludeFiles = this.options.excludeFiles || this._defaultExclude;
    const developmentFiles =
      this.options.developmentFiles || this._defaultDevelopment || [];

    this.logger.debug(`Finding files to read for ${this.system} dependencies`, {
      includeFiles,
      excludeFiles,
    });
    const allFiles = globule.find(includeFiles, {
      ignore: excludeFiles,
      cwd: this.cwd,
    });
    const devFiles = globule.find(developmentFiles, {
      ignore: excludeFiles,
      cwd: this.cwd,
    });
    return {
      dev: devFiles,
      any: allFiles.filter((file) => !devFiles.includes(file)),
    };
  }

  protected resolveVersion(
    moduleName: string,
    version?: string,
  ): string | undefined {
    try {
      return resolveVersion(this.system, version);
    } catch (error) {
      this.logger.warn(
        `Error resolving version "${version}" of dependency ${moduleName}`,
        error,
      );
      return version;
    }
  }
}
