import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
} from "./DependenciesReader.types";
import { GoDependenciesReader } from "./GoDependenciesReader.js";
import { MavenDependenciesReader } from "./MavenDependenciesReader.js";
import { NpmDependenciesReader } from "./NpmDependenciesReader.js";
import { PythonDependenciesReader } from "./PythonDependenciesReader.js";

/**
 * Read all direct dependencies, from any system
 */
export class DirectDependenciesReader {
  private _nodeDependenciesReader: NpmDependenciesReader;
  private _mavenDependenciesReader: MavenDependenciesReader;
  private _pythonDependenciesReader: PythonDependenciesReader;
  private _goDependenciesReader: GoDependenciesReader;
  private _logger: DependenciesReaderOptions["logger"];

  constructor({
    logger,
    cwd,
    npm,
    maven,
    python,
    go,
    development,
    production,
  }: DependenciesReaderOptions) {
    this._nodeDependenciesReader = new NpmDependenciesReader({
      logger,
      cwd,
      options: npm,
      development,
      production,
    });
    this._mavenDependenciesReader = new MavenDependenciesReader({
      logger,
      cwd,
      options: maven,
      development,
      production,
    });
    this._pythonDependenciesReader = new PythonDependenciesReader({
      logger,
      cwd,
      options: python,
      production,
      development,
    });
    this._goDependenciesReader = new GoDependenciesReader({
      logger,
      cwd,
      options: go,
      development,
      production,
    });
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");

    const dependencies = await Promise.all([
      this._nodeDependenciesReader.getDependencies(),
      this._mavenDependenciesReader.getDependencies(),
      this._pythonDependenciesReader.getDependencies(),
      this._goDependenciesReader.getDependencies(),
    ]);

    return dependencies.flat();
  }
}
