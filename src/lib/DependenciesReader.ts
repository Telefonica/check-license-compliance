import fsExtra from "fs-extra";
import globule from "globule";
import path from "node:path";
import semver from "semver";

import type {
  DependenciesReaderOptions,
  DependenciesReader,
  DependencyDeclaration,
  NodePackageJson,
  DependencyUniqueProps,
  DependencyId,
} from "./DependenciesReader.types";

const NODE_SYSTEM = "NPM";

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
export class BaseDependenciesReader implements DependenciesReader {
  protected _logger: DependenciesReaderOptions["logger"];

  constructor({ logger }: DependenciesReaderOptions) {
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

/**
 * Read the Node.js dependencies from the package.json files in the project
 */
export class NodeDependenciesReader extends BaseDependenciesReader {
  constructor(options: DependenciesReaderOptions) {
    super(options);
  }

  private _getPackageJsonFiles(): string[] {
    // TODO: Resolve from custom cwd
    return globule.find("**/package.json", {
      ignore: ["node_modules/**"],
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
        system: NODE_SYSTEM,
        id: getDependencyId({
          system: NODE_SYSTEM,
          name,
          version,
        }),
        name,
        version,
        // TODO: To be able to use custom cwd
        origin: path.relative(process.cwd(), packageJsonPath),
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

/**
 * Read all dependencies from the project, from any system
 */
export class ProjectDependenciesReader {
  private _nodeDependenciesReader: NodeDependenciesReader;
  private _logger: DependenciesReaderOptions["logger"];

  // TODO: Pass here options for each system and files to read
  constructor({ logger }: DependenciesReaderOptions) {
    this._nodeDependenciesReader = new NodeDependenciesReader({ logger });
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");
    // TODO, add readers for other systems
    return this._nodeDependenciesReader.getDependencies();
  }
}
