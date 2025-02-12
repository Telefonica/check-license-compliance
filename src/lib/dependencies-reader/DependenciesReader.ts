// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import type {
  DependenciesReaderOptions,
  DependencyDeclaration,
} from "./DependenciesReader.types";
import { GoDependenciesReader } from "./GoDependenciesReader.js";
import { MavenDependenciesReader } from "./MavenDependenciesReader.js";
import { NpmDependenciesReader } from "./NpmDependenciesReader.js";
import { PythonDependenciesReader } from "./PythonDependenciesReader.js";

/**
 * Read all direct dependencies, from all systems
 */
export class DirectDependenciesReader {
  private _nodeDependenciesReader: NpmDependenciesReader;
  private _mavenDependenciesReader: MavenDependenciesReader;
  private _pythonDependenciesReader: PythonDependenciesReader;
  private _goDependenciesReader: GoDependenciesReader;
  private _logger: DependenciesReaderOptions["logger"];

  /**
   * Create a new instance of the DirectDependenciesReader
   * @param options The options to create the reader
   */
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

  /**
   * Read the dependencies from all systems
   * @returns The list of dependency declarations
   */
  public async readDependencies(): Promise<DependencyDeclaration[]> {
    this._logger.info("Reading project dependencies");

    const dependencies = await Promise.all([
      this._nodeDependenciesReader.readDependencies(),
      this._mavenDependenciesReader.readDependencies(),
      this._pythonDependenciesReader.readDependencies(),
      this._goDependenciesReader.readDependencies(),
    ]);

    return dependencies.flat();
  }
}
