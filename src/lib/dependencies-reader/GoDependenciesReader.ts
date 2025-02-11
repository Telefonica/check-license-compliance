import path from "node:path";

import fsExtra from "fs-extra";

import { BaseSystemDependenciesReader } from "./BaseSystemDependenciesReader.js";
import type {
  SystemDependenciesReaderOptions,
  DependencyDeclaration,
  GoDependenciesReaderOptions,
} from "./DependenciesReader.types";
import { GO_SYSTEM, getDependencyId } from "./Helpers.js";

/**
 * Read the Go dependencies from the go.mod files in the project
 */
export class GoDependenciesReader extends BaseSystemDependenciesReader<GoDependenciesReaderOptions> {
  constructor(
    options: SystemDependenciesReaderOptions<GoDependenciesReaderOptions>,
  ) {
    super(options, {
      system: GO_SYSTEM,
      defaultInclude: ["**/go.mod"],
      defaultExclude: ["**/vendor/**"],
    });
  }

  private async _getGoModDependencies(
    goModPath: string,
  ): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading dependencies from ${goModPath}`);
    const resolvedPath = path.resolve(this.cwd, goModPath);

    const goMod = await fsExtra.readFile(resolvedPath, "utf8");
    const dependencies: DependencyDeclaration[] = [];
    const lines = goMod.split("\n");

    let inRequireBlock = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("require (")) {
        inRequireBlock = true;
        continue;
      }

      if (inRequireBlock && trimmedLine.startsWith(")")) {
        inRequireBlock = false;
        continue;
      }

      if (inRequireBlock || trimmedLine.startsWith("require ")) {
        const parts = trimmedLine.replace("require ", "").trim().split(/\s+/);
        if (parts.length === 2) {
          const [name, version] = parts;
          const resolvedVersion = this.resolveVersion(name, version);
          dependencies.push({
            system: GO_SYSTEM,
            id: getDependencyId({
              system: GO_SYSTEM,
              name,
              version,
            }),
            name,
            version,
            resolvedVersion,
            origin: path.relative(this.cwd, goModPath),
            development: false,
            production: true,
          });
        }
      }
    }

    this.logger.debug(`Dependencies found in ${goModPath}`, { dependencies });

    return dependencies;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading ${this.system} dependencies`);

    const goModFiles = this.findFiles();
    const dependencies = await Promise.all(
      goModFiles.map((goModPath) => this._getGoModDependencies(goModPath)),
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
