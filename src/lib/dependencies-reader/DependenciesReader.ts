// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
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
  private _errors: Error[] = [];
  private _warnings: string[] = [];

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
    this._errors = [];
    this._warnings = [];
    this._logger.info("Reading project dependencies");

    const dependencies = await Promise.all([
      this._nodeDependenciesReader.readDependencies(),
      this._mavenDependenciesReader.readDependencies(),
      this._pythonDependenciesReader.readDependencies(),
      this._goDependenciesReader.readDependencies(),
    ]);

    this._errors = [
      ...this._nodeDependenciesReader.errors,
      ...this._mavenDependenciesReader.errors,
      ...this._pythonDependenciesReader.errors,
      ...this._goDependenciesReader.errors,
    ];

    this._warnings = [
      ...this._nodeDependenciesReader.warnings,
      ...this._mavenDependenciesReader.warnings,
      ...this._pythonDependenciesReader.warnings,
      ...this._goDependenciesReader.warnings,
    ];

    return dependencies.flat();
  }

  /**
   * Return the errors found while reading dependencies
   * @returns List of errors found while reading dependencies
   */
  public get errors(): Error[] {
    return this._errors;
  }

  /**
   * Return the warnings found while reading dependencies
   * @returns List of warnings found while reading dependencies
   */
  public get warnings(): string[] {
    return this._warnings;
  }
}
