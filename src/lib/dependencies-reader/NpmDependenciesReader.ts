// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import fsExtra from "fs-extra";

import { BaseSystemDependenciesReader } from "./BaseSystemDependenciesReader.js";
import type {
  SystemDependenciesReaderOptions,
  DependencyDeclaration,
  NpmPackageJson,
  NpmDependenciesReaderOptions,
} from "./DependenciesReader.types";
import { NPM_SYSTEM, getDependencyId } from "./Helpers.js";

/**
 * Read the NPM dependencies from the package.json files in the project
 */
export class NpmDependenciesReader extends BaseSystemDependenciesReader<NpmDependenciesReaderOptions> {
  constructor(
    options: SystemDependenciesReaderOptions<NpmDependenciesReaderOptions>,
  ) {
    super(options, {
      system: NPM_SYSTEM,
      defaultInclude: ["**/package.json"],
      defaultExclude: ["**/node_modules/**"],
    });
  }

  /**
   * Read the dependencies from a package.json file content
   * @param packageJson The package.json content to read the dependencies from
   * @param filePath The path to the package.json file, useful for the origin field in the dependencies
   * @param devDependencies Whether to read devDependencies or dependencies.
   * @param isDevelopment If the dependencies should be considered as development dependencies, no matter if they are devDependencies or dependencies.
   * @returns The dependencies found in the pom.xml content
   */
  private _getPackageJsonDependenciesInfo(
    packageJson: NpmPackageJson,
    filePath: string,
    devDependencies: boolean = false,
    isDevelopment = false,
  ) {
    const key = devDependencies ? "devDependencies" : "dependencies";

    const dependencies = packageJson[key];
    if (!dependencies) {
      return [];
    }
    return Object.keys(dependencies).map((name) => {
      const version = dependencies[name];
      const resolvedVersion = this.resolveVersion(name, dependencies[name]);
      return {
        system: NPM_SYSTEM,
        id: getDependencyId({
          system: NPM_SYSTEM,
          name,
          version,
        }),
        name,
        version,
        resolvedVersion,
        origin: filePath,
        development: isDevelopment ? isDevelopment : devDependencies,
        production: isDevelopment ? isDevelopment : !devDependencies,
      };
    });
  }

  /**
   * Read the dependencies from a package.json file
   * @param filePath The path to the package.json file to read the dependencies from
   * @param isDevelopment If the dependencies should be considered as development dependencies
   * @returns The dependencies found in the package.json file
   */
  public async readFileDependencies(
    filePath: string,
    isDevelopment = false,
  ): Promise<DependencyDeclaration[]> {
    this.logger.verbose(`Reading dependencies from ${filePath}`);
    const resolvedPath = path.resolve(this.cwd, filePath);

    const packageJson = (await fsExtra.readJson(
      resolvedPath,
    )) as NpmPackageJson;

    const packageProductionDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      resolvedPath,
      false,
      isDevelopment,
    );
    const packageDevDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      resolvedPath,
      true,
      isDevelopment,
    );

    const dependencies = [
      ...packageProductionDependencies,
      ...packageDevDependencies,
    ];

    this.logger.verbose(
      `Found ${dependencies.length} dependencies in ${filePath}`,
    );
    this.logger.debug(`Dependencies found in ${filePath}`, {
      dependencies,
    });

    return dependencies;
  }
}
