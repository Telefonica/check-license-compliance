import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
} from "./DependenciesReader.types";
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
  private _logger: DependenciesReaderOptions["logger"];

  constructor({ logger, cwd, npm, maven, python }: DependenciesReaderOptions) {
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
    this._pythonDependenciesReader = new PythonDependenciesReader({
      logger,
      cwd,
      options: python,
    });
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");

    const dependencies = await Promise.all([
      this._nodeDependenciesReader.getDependencies(),
      this._mavenDependenciesReader.getDependencies(),
      this._pythonDependenciesReader.getDependencies(),
    ]);

    return dependencies.flat();
  }
}
