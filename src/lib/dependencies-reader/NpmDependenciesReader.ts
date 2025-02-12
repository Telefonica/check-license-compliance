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

  private _getPackageJsonDependenciesInfo(
    packageJson: NpmPackageJson,
    packageJsonPath: string,
    dev: boolean = false,
  ) {
    const key = dev ? "devDependencies" : "dependencies";

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
        origin: path.relative(this.cwd, packageJsonPath),
        development: dev,
        production: !dev,
      };
    });
  }

  public async readFileDependencies(
    packageJsonPath: string,
    isDevelopment = false,
  ): Promise<DependencyDeclaration[]> {
    this.logger.verbose(`Reading dependencies from ${packageJsonPath}`);
    const resolvedPath = path.resolve(this.cwd, packageJsonPath);

    const packageJson = (await fsExtra.readJson(
      resolvedPath,
    )) as NpmPackageJson;

    const packageProductionDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      resolvedPath,
      isDevelopment,
    );
    const packageDevDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      resolvedPath,
      true,
    );

    const dependencies = [
      ...packageProductionDependencies,
      ...packageDevDependencies,
    ];

    this.logger.verbose(
      `Found ${dependencies.length} dependencies in ${packageJsonPath}`,
    );
    this.logger.debug(`Dependencies found in ${packageJsonPath}`, {
      dependencies,
    });

    return dependencies;
  }
}
