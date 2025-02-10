import path from "node:path";

import fsExtra from "fs-extra";
import globule from "globule";

import { BaseSystemDependenciesReader } from "./BaseSystemDependenciesReader";
import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
  NodePackageJson,
} from "./DependenciesReader.types";
import { NPM_SYSTEM, getDependencyId } from "./Helpers";

/**
 * Read the NPM dependencies from the package.json files in the project
 */
export class NpmDependenciesReader extends BaseSystemDependenciesReader {
  constructor(options: DependenciesReaderOptions) {
    super(options);
  }

  private _getPackageJsonFiles(): string[] {
    return globule.find("**/package.json", {
      ignore: ["node_modules/**"],
      cwd: this.cwd,
    });
  }

  private _getPackageJsonDependenciesInfo(
    packageJson: NodePackageJson,
    packageJsonPath: string,
    dev: boolean = false,
  ) {
    const key = dev ? "devDependencies" : "dependencies";

    const dependencies = packageJson[key];
    if (!dependencies) {
      return [];
    }
    const dependenciesFormatted = Object.keys(dependencies).map((name) => {
      const version = this.getVersionFromSemverRange(dependencies[name], name);
      return {
        system: NPM_SYSTEM,
        id: getDependencyId({
          system: NPM_SYSTEM,
          name,
          version,
        }),
        name,
        version,
        // TODO: To be able to use custom cwd
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
    this._logger.info(`Reading dependencies from ${packageJsonPath}`);

    const packageJson = (await fsExtra.readJson(
      packageJsonPath,
    )) as NodePackageJson;

    const packageProductionDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      packageJsonPath,
    );
    const packageDevDependencies = this._getPackageJsonDependenciesInfo(
      packageJson,
      packageJsonPath,
      true,
    );

    this._logger.debug(`Dependencies found in ${packageJsonPath}`, {
      production: packageProductionDependencies,
      development: packageDevDependencies,
    });

    return [...packageProductionDependencies, ...packageDevDependencies];
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading Node.js dependencies");
    const packageJsonFiles = this._getPackageJsonFiles();
    const dependencies = await Promise.all(
      packageJsonFiles.map((packageJsonPath) =>
        this._getPackageJsonDependencies(packageJsonPath),
      ),
    );
    const flatDependencies = dependencies.flat();
    this._logger.info(
      `Found ${flatDependencies.length} Node.js direct dependencies in the project`,
    );
    this._logger.debug(`Node.js dependencies`, flatDependencies);
    return flatDependencies;
  }
}
