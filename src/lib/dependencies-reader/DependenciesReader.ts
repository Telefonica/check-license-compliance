import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
} from "./DependenciesReader.types";
import { MavenDependenciesReader } from "./MavenDependenciesReader.js";
import { NpmDependenciesReader } from "./NpmDependenciesReader.js";

/**
 * Read all direct dependencies, from any system
 */
export class DirectDependenciesReader {
  private _nodeDependenciesReader: NpmDependenciesReader;
  private _mavenDependenciesReader: MavenDependenciesReader;
  private _logger: DependenciesReaderOptions["logger"];

  constructor({ logger, cwd, npm, maven }: DependenciesReaderOptions) {
    this._nodeDependenciesReader = new NpmDependenciesReader({
      logger,
      cwd,
      options: npm,
    });
    this._mavenDependenciesReader = new MavenDependenciesReader({
      logger,
      cwd,
      options: maven,
    });
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");

    const dependencies = await Promise.all([
      this._nodeDependenciesReader.getDependencies(),
      this._mavenDependenciesReader.getDependencies(),
    ]);

    return dependencies.flat();
  }
}
