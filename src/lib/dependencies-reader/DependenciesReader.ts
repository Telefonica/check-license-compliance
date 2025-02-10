import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
} from "./DependenciesReader.types";
import { NpmDependenciesReader } from "./NpmDependenciesReader";

/**
 * Read all direct dependencies, from any system
 */
export class DirectDependenciesReader {
  private _nodeDependenciesReader: NpmDependenciesReader;
  private _logger: DependenciesReaderOptions["logger"];

  // TODO: Pass here options for each system and files to read
  constructor({ logger, cwd }: DependenciesReaderOptions) {
    this._nodeDependenciesReader = new NpmDependenciesReader({ logger, cwd });
    this._logger = logger;
  }

  public async getDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");
    // TODO, add readers for other systems
    return this._nodeDependenciesReader.getDependencies();
  }
}
