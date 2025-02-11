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

  private _getPomDependenciesInfo(pom: string, filePath: string) {
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
          `Resolving version ${version} from project properties in ${filePath}`,
          {
            version,
          },
        );
        const propName = version.slice(2, -1);
        if (!properties[propName]) {
          this.logger.warn(
            `Property ${propName} not found in project properties of ${filePath}. Unable to resolve version.`,
          );
        }
        return properties[propName];
      }
      return version;
    };

    const deps = dependencies.map((dep) => {
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
        origin: path.relative(this.cwd, filePath),
        development:
          scope === "test" || scope === "provided" || scope === "runtime",
        production: scope === COMPILE,
      };
    });

    this.logger.debug(`Dependencies found in ${filePath}`, {
      dependencies: deps,
    });
    return deps;
  }

  private async _getPomDependencies(
    pomPath: string,
  ): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading dependencies from ${pomPath}`);
    const resolvedPath = path.resolve(this.cwd, pomPath);

    // Read the pom.xml file
    const pomXml = await fsExtra.readFile(resolvedPath, "utf8");

    // Parse the pom.xml file to get the dependencies
    const dependencies = this._getPomDependenciesInfo(pomXml, resolvedPath);

    this.logger.debug(`Dependencies found in ${pomPath}`, dependencies);

    return dependencies;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this.logger.info(`Reading ${this.system} dependencies`);
    const pomFiles = this.findFiles();
    const dependencies = await Promise.all(
      pomFiles.map((pomPath) => this._getPomDependencies(pomPath)),
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
