import path from "node:path";

import fsExtra from "fs-extra";

import { BaseSystemDependenciesReader } from "./BaseSystemDependenciesReader.js";
import type {
  SystemDependenciesReaderOptions,
  DependencyDeclaration,
  PythonDependenciesReaderOptions,
} from "./DependenciesReader.types";
import { PYTHON_SYSTEM, getDependencyId } from "./Helpers.js";

/**
 * Read the Python dependencies from the requirements.txt files in the project
 */
export class PythonDependenciesReader extends BaseSystemDependenciesReader<PythonDependenciesReaderOptions> {
  constructor(
    options: SystemDependenciesReaderOptions<PythonDependenciesReaderOptions>,
  ) {
    super(options, {
      system: PYTHON_SYSTEM,
      defaultInclude: ["**/requirements.txt"],
      defaultDevelopment: ["**/requirements-dev.txt"],
      // cspell: disable-next-line
      defaultExclude: ["**/venv/**"],
    });
  }

  public async readFileDependencies(
    requirementsTxtPath: string,
    isDevelopment = false,
    processedFiles: Set<string> = new Set(),
  ): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading dependencies from ${requirementsTxtPath}`);
    const resolvedPath = path.resolve(this.cwd, requirementsTxtPath);

    if (processedFiles.has(resolvedPath)) {
      this.logger.warn(`Skipping already processed file: ${resolvedPath}`);
      return [];
    }
    processedFiles.add(resolvedPath);

    const requirementsTxt = await fsExtra.readFile(resolvedPath, "utf8");
    const dependencies: DependencyDeclaration[] = [];
    const lines = requirementsTxt
      .split("\n")
      .filter((line) => line && !line.startsWith("#"));

    for (const line of lines) {
      if (line.startsWith("-r ") || line.startsWith("--requirement ")) {
        const includedFile = line.split(" ")[1];
        const includedFilePath = path.resolve(
          path.dirname(resolvedPath),
          includedFile,
        );
        const includedDependencies = await this.readFileDependencies(
          includedFilePath,
          isDevelopment,
          processedFiles,
        );
        dependencies.push(...includedDependencies);
      } else {
        const match = line.match(/(.*?)(==|>=|<=|!=|~=)(.*)/);
        if (!match) {
          this.logger.warn(`Invalid dependency format: ${line}`);
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let [_, name, operator, version] = match;
        let versionToAssign: string | undefined = version;
        if (name.includes("[")) {
          this.logger.warn(
            `Removing extras from dependency: ${getDependencyId({ system: PYTHON_SYSTEM, name, version })}. You should add the corresponding extra modules manually to the configuration file`,
          );
          name = name.split("[")[0];
        }
        if (operator === "!=") {
          versionToAssign = undefined;
        }
        const resolvedVersion = this.resolveVersion(name, version);
        dependencies.push({
          system: PYTHON_SYSTEM,
          id: getDependencyId({
            system: PYTHON_SYSTEM,
            name,
            version: versionToAssign,
          }),
          name,
          version: versionToAssign,
          resolvedVersion,
          origin: path.relative(this.cwd, requirementsTxtPath),
          development: isDevelopment,
          production: !isDevelopment,
        });
      }
    }

    this.logger.debug(`Dependencies found in ${requirementsTxtPath}`, {
      dependencies,
    });

    return dependencies;
  }
}
