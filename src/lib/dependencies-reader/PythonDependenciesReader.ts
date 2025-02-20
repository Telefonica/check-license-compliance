// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
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
    const resolvedPath = path.resolve(this.cwd, filePath);
    const relativePath = path.relative(this.cwd, resolvedPath);
    this.logger.verbose(
      `${this.system}: Reading dependencies from ${relativePath}`,
    );
    const recursiveRequirements =
      this.options.recursiveRequirements == undefined
        ? true
        : this.options.recursiveRequirements;

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
            `Reading ${this.system} included file in ${relativePath}`,
          );
          try {
            const includedDependencies = await this.readFileDependencies(
              includedFilePath,
              isDevelopment,
              processedFiles,
            );
            dependencies.push(...includedDependencies);
          } catch (error) {
            this.logger.error(
              `${this.system}: Error reading dependencies from included file ${includedFilePath}`,
              error,
            );
            this.readErrors.push(error as Error);
          }
        } else {
          this.logger.verbose(
            `Skipping read of ${this.system} included file in ${relativePath} because recursiveRequirements is disabled`,
          );
        }
      } else {
        const match = line.match(/(.*?)(==|>=|<=|!=|~=)(.*)/);
        if (!match) {
          const message = `${this.system}: Invalid dependency format reading file ${relativePath}. Line content: "${line}"`;
          this.logger.warn(message);
          this.readWarnings.push(message);
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let [_, name, operator, version] = match;
        let versionToAssign: string | undefined = version;
        if (name.includes("[")) {
          const message = `${this.system}: Removed extras from dependency: ${getDependencyId({ system: PYTHON_SYSTEM, name, version })}. You should add the corresponding extra modules manually to the configuration file`;
          this.logger.warn(message);
          this.readWarnings.push(message);
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
          origin: relativePath,
          development: isDevelopment,
          production: !isDevelopment,
        });
      }
    }

    this.logger.verbose(
      `Found ${dependencies.length} dependencies in ${relativePath}`,
    );
    this.logger.debug(`Dependencies found in ${relativePath}`, {
      dependencies,
    });

    return dependencies;
  }
}
