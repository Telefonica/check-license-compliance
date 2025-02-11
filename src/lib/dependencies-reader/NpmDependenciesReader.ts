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
    const dependenciesFormatted = Object.keys(dependencies).map((name) => {
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
    return dependenciesFormatted;
  }

  private async _getPackageJsonDependencies(
    packageJsonPath: string,
  ): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading dependencies from ${packageJsonPath}`);
    const resolvedPath = path.resolve(this.cwd, packageJsonPath);

    const packageJson = (await fsExtra.readJson(
      resolvedPath,
    )) as NpmPackageJson;

    const packageProductionDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      resolvedPath,
    );
    const packageDevDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      resolvedPath,
      true,
    );

    this.logger.debug(`Dependencies found in ${packageJsonPath}`, {
      production: packageProductionDependencies,
      development: packageDevDependencies,
    });

    return [...packageProductionDependencies, ...packageDevDependencies];
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading ${this.system} dependencies`);

    const packageJsonFiles = this.findFiles();
    const dependencies = await Promise.all(
      packageJsonFiles.map((packageJsonPath) =>
        this._getPackageJsonDependencies(packageJsonPath),
      ),
    );
    const flatDependencies = dependencies.flat();

    this.logger.info(
      `Found ${flatDependencies.length} ${this.system} direct dependencies in the project`,
    );
    this.logger.debug(`${this.system} dependencies`, {
      dependencies: flatDependencies,
    });

    return flatDependencies;
  }
}
