import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
} from "./DependenciesReader.types";
import { NpmDependenciesReader } from "./NpmDependenciesReader.js";

/**
 * Read all direct dependencies, from any system
 */
export class DirectDependenciesReader {
  private _nodeDependenciesReader: NpmDependenciesReader;
  private _logger: DependenciesReaderOptions["logger"];

  constructor({ logger, cwd, npm }: DependenciesReaderOptions) {
    this._nodeDependenciesReader = new NpmDependenciesReader({
      logger,
      cwd,
      options: npm,
    });
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");
    // TODO, add readers for other systems
    return this._nodeDependenciesReader.getDependencies();
  }
}
