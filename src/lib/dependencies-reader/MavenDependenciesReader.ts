// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import { XMLParser } from "fast-xml-parser";
import fsExtra from "fs-extra";

import { BaseSystemDependenciesReader } from "./BaseSystemDependenciesReader.js";
import type {
  SystemDependenciesReaderOptions,
  DependencyDeclaration,
  MavenDependenciesReaderOptions,
  MavenPom,
} from "./DependenciesReader.types";
import { MAVEN_SYSTEM, getDependencyId } from "./Helpers.js";

const COMPILE = "compile";

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Read the Maven dependencies from the pom.xml files in the project
 */
export class MavenDependenciesReader extends BaseSystemDependenciesReader<MavenDependenciesReaderOptions> {
  constructor(
    options: SystemDependenciesReaderOptions<MavenDependenciesReaderOptions>,
  ) {
    super(options, {
      system: MAVEN_SYSTEM,
      defaultInclude: ["**/pom.xml"],
      defaultExclude: [],
    });
  }

  /**
   * Read the dependencies from a pom.xl content
   * @param pom The pom.xml content to read the dependencies from
   * @param relativePath The relative path to the pom.xml file
   * @param isDevelopment If the dependencies should be considered as development dependencies
   * @returns The dependencies found in the pom.xml content
   */
  private _getPomDependenciesInfo(
    pom: string,
    relativePath: string,
    isDevelopment = false,
  ): DependencyDeclaration[] {
    const pomData = new XMLParser().parse(pom) as MavenPom;

    const properties = pomData.project.properties || {};
    const pomDependencies = pomData.project.dependencies?.dependency || [];
    const dependencies = Array.isArray(pomDependencies)
      ? pomDependencies
      : [pomDependencies];

    const resolveVersionFromProperties = (
      version?: string | number,
    ): string | undefined => {
      if (isNumber(version)) {
        return version.toString();
      }
      if (version && version.startsWith("${") && version.endsWith("}")) {
        this.logger.silly(
          `Resolving version ${version} from project properties in ${relativePath}`,
          {
            version,
          },
        );
        const propName = version.slice(2, -1);
        if (!properties[propName]) {
          const message = `${this.system}: Property ${propName} not found in project properties of ${relativePath}. Unable to resolve version.`;
          this.logger.warn(message, { propName, properties });
          this.readWarnings.push(message);
        }
        return properties[propName];
      }
      return version;
    };

    return dependencies.map((dep) => {
      const name = `${dep.groupId}:${dep.artifactId}`;
      const version = resolveVersionFromProperties(dep.version);
      const resolvedVersion = this.resolveVersion(name, version);
      const scope = dep.scope || COMPILE;
      return {
        system: MAVEN_SYSTEM,
        name,
        id: getDependencyId({
          system: MAVEN_SYSTEM,
          name,
          version,
        }),
        version,
        resolvedVersion,
        origin: relativePath,
        development:
          isDevelopment ||
          scope === "test" ||
          scope === "provided" ||
          scope === "runtime",
        production: !isDevelopment && scope === COMPILE,
      };
    });
  }

  /**
   * Read the dependencies from a pom.xml file
   * @returns The dependencies found in the pom.xml file
   */
  public async readFileDependencies(
    filePath: string,
    isDevelopment = false,
  ): Promise<DependencyDeclaration[]> {
    const resolvedPath = path.resolve(this.cwd, filePath);
    const relativePath = path.relative(this.cwd, resolvedPath);
    this.logger.verbose(
      `${this.system}: Reading dependencies from ${relativePath}`,
    );

    // Read the pom.xml file
    const pomXml = await fsExtra.readFile(resolvedPath, "utf8");

    // Parse the pom.xml file to get the dependencies
    const dependencies = this._getPomDependenciesInfo(
      pomXml,
      relativePath,
      isDevelopment,
    );

    this.logger.verbose(
      `Found ${dependencies.length} dependencies in ${relativePath}`,
    );

    this.logger.debug(`Dependencies found in ${relativePath}`, dependencies);

    return dependencies;
  }
}
