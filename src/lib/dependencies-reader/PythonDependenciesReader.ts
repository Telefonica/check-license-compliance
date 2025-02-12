// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

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
      defaultExclude: ["**/venv/**", "**/.venv/**"],
    });
  }

  /**
   * Read the dependencies from a requirements.txt file
   * @param filePath The path to the requirements.txt file to read the dependencies from
   * @param isDevelopment If the dependencies should be considered as development dependencies
   * @param processedFiles A set of already processed files to avoid circular dependencies when reading included files
   * @returns The dependencies found in the requirements.txt file
   */
  public async readFileDependencies(
    filePath: string,
    isDevelopment = false,
    processedFiles: Set<string> = new Set(),
  ): Promise<DependencyDeclaration[]> {
    this.logger.verbose(`Reading dependencies from ${filePath}`);
    const recursiveRequirements =
      this.options.recursiveRequirements == undefined
        ? true
        : this.options.recursiveRequirements;

    const resolvedPath = path.resolve(this.cwd, filePath);

    if (processedFiles.has(resolvedPath)) {
      this.logger.warn(`Skipping already processed file: ${resolvedPath}`);
      return [];
    }
    processedFiles.add(resolvedPath);

    const requirementsTxt = await fsExtra.readFile(resolvedPath, "utf8");
    const dependencies: DependencyDeclaration[] = [];
    const lines = requirementsTxt
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.trim())
      .filter((line) => line.length);

    for (const line of lines) {
      if (line.startsWith("-r ") || line.startsWith("--requirement ")) {
        if (recursiveRequirements) {
          const includedFile = line.split(" ")[1];
          const includedFilePath = path.resolve(
            path.dirname(resolvedPath),
            includedFile,
          );
          this.logger.verbose(
            `Reading ${this.system} included file in ${filePath}`,
          );
          const includedDependencies = await this.readFileDependencies(
            includedFilePath,
            isDevelopment,
            processedFiles,
          );
          dependencies.push(...includedDependencies);
        } else {
          this.logger.verbose(
            `Skipping read of ${this.system} included file in ${filePath} because recursiveRequirements is disabled`,
          );
        }
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
          origin: path.relative(this.cwd, filePath),
          development: isDevelopment,
          production: !isDevelopment,
        });
      }
    }

    this.logger.verbose(
      `Found ${dependencies.length} dependencies in ${filePath}`,
    );
    this.logger.debug(`Dependencies found in ${filePath}`, {
      dependencies,
    });

    return dependencies;
  }
}
