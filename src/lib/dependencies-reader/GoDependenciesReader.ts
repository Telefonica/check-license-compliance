// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

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
  /**
   * Create a new instance of the GoDependenciesReader
   * @param options The options to create the reader
   */
  constructor(
    options: SystemDependenciesReaderOptions<GoDependenciesReaderOptions>,
  ) {
    super(options, {
      system: GO_SYSTEM,
      defaultInclude: ["**/go.mod"],
      defaultExclude: ["**/vendor/**"],
    });
  }

  /**
   * Read the dependencies from a go.mod file in the project
   * @param filePath The path to the go.mod file to read the dependencies from
   * @param isDevelopment If the dependencies should be considered as development dependencies
   * @returns The dependencies found in the go.mod file
   */
  public async readFileDependencies(
    filePath: string,
    isDevelopment = false,
  ): Promise<DependencyDeclaration[]> {
    this.logger.verbose(`Reading dependencies from ${filePath}`);
    const resolvedPath = path.resolve(this.cwd, filePath);

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
            origin: path.relative(this.cwd, filePath),
            development: isDevelopment,
            production: !isDevelopment,
          });
        }
      }
    }
    this.logger.verbose(
      `Found ${dependencies.length} dependencies in ${filePath}`,
    );
    this.logger.debug(`Dependencies found in ${filePath}`, { dependencies });

    return dependencies;
  }
}
