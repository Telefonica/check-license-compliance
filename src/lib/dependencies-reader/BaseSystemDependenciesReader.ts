// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

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
import {
  resolveVersion,
  getDependencyNameAndVersionFromId,
} from "./Helpers.js";

const NODE_SYSTEM: System = "NPM";

const SYSTEM_IDS = [NODE_SYSTEM];

/**
 * Creates an unique id for a dependency
 * @param dependency The dependency data to create the id from
 * @returns An unique id for the dependency, containing the system, name and version
 */
export function getDependencyId(
  dependency: DependencyUniqueProps,
): DependencyId {
  return `${dependency.system}:${dependency.name}@${dependency.version}`;
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
 * Checks if a dependency id has a system id
 * @param dependencyId The dependency id to check
 * @returns True if the dependency id has a system id, false otherwise
 */
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
  protected readErrors: Error[] = [];
  protected readWarnings: string[] = [];
  private _defaultInclude: string[];
  private _defaultExclude: string[];
  private _defaultDevelopment: string[];

  /**
   * Creates a new base system dependencies reader
   * @param options The options for the reader
   * @param system The system to read dependencies from
   */
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

  /**
   * Given a module name and version, resolve the version to a valid one
   * @param moduleName The name of the module
   * @param version The version to resolve
   * @returns The resolved version or the original version if it could not be resolved
   */
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

  /**
   * Read the file dependencies. To be implemented by the child class
   * @param _filePath The file path to read dependencies from
   * @param _isDevelopment Whether the file is marked as development, so all of its dependencies should be marked as development
   * @returns The dependencies found in the file
   */
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

  /**
   * Read the file dependencies handling errors
   * @param filePath The file path to read dependencies from
   * @param isDevelopment Whether the file is marked as development, so all of its dependencies should be marked as development
   * @returns The dependencies found in the file or an empty array if an error occurred
   */
  public async readFileDependenciesHandlingErrors(
    filePath: string,
    isDevelopment?: boolean,
  ): Promise<DependencyDeclaration[]> {
    try {
      const dependencies = await this.readFileDependencies(
        filePath,
        isDevelopment,
      );
      return dependencies;
    } catch (error) {
      this.logger.error(
        `${this.system}: Error reading dependencies from ${filePath}`,
        error,
      );
      this.readErrors.push(error as Error);
      return [];
    }
  }

  /**
   * Read the dependencies from the project files for the system
   * @returns The system dependencies found in the project or an empty array if an error occurred
   */
  public async readDependencies(): Promise<DependencyDeclaration[]> {
    this.readErrors = [];
    this.readWarnings = [];
    this.logger.info(`Reading ${this.system} dependencies`);

    try {
      const { dev, any } = this.findFiles();
      const dependencies = await Promise.all(
        any.map((goModPath) =>
          this.readFileDependenciesHandlingErrors(goModPath),
        ),
      );
      let devDependencies: DependencyDeclaration[] = [];
      if (this.development) {
        devDependencies = (
          await Promise.all(
            dev.map((filePath) =>
              this.readFileDependenciesHandlingErrors(filePath, true),
            ),
          )
        ).flat();
      } else {
        this.logger.warn(
          `Skipping read ${this.system} development dependencies`,
        );
      }
      const flatDependencies = [...dependencies, ...devDependencies].flat();

      this.logger.info(
        `Found ${flatDependencies.length} ${this.system} direct dependencies in the project`,
      );

      let finalDependencies: DependencyDeclaration[] = flatDependencies;

      if (this.options.extraModules) {
        this.logger.info(
          `Adding extra modules to ${this.system} dependencies: ${this.options.extraModules.join(", ")}`,
        );
        finalDependencies = [
          ...flatDependencies,
          ...this._getExtraModulesInfo(this.options.extraModules),
        ].flat();
      }

      this.logger.debug(`${this.system} dependencies`, {
        dependencies: finalDependencies,
      });

      return finalDependencies;
    } catch (error) {
      this.readErrors.push(error as Error);

      return [];
    }
  }

  /**
   * Return the errors found while reading dependencies
   * @returns List of errors found while reading dependencies
   */
  public get errors(): Error[] {
    return this.readErrors;
  }

  public get warnings(): string[] {
    return this.readWarnings;
  }

  /**
   * Return information about extra modules to add to the dependencies
   * @param extraModules The extra modules to add
   * @returns Array of dependency declarations for the extra modules
   */
  private _getExtraModulesInfo(
    extraModules: string[],
  ): DependencyDeclaration[] {
    return extraModules.map((moduleNameAndVersion) => {
      const { name, version } =
        getDependencyNameAndVersionFromId(moduleNameAndVersion);
      const resolvedVersion = this.resolveVersion(name, version);

      if (!name || !version) {
        const message = `Invalid extra module: ${moduleNameAndVersion}. It should be in the format name@version`;
        this.logger.error(message);
        this.readErrors.push(new Error(message));
      }

      return {
        system: this.system,
        id: getDependencyId({
          system: this.system,
          name,
          version,
        }),
        name,
        version,
        resolvedVersion,
        origin: "extraModules",
        development: true,
        production: true,
      };
    });
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
}
