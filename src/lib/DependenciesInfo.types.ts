// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import type {
  DependencyUniqueProps,
  DependencyId,
  NpmDependenciesReaderOptions,
  MavenDependenciesReaderOptions,
  PythonDependenciesReaderOptions,
  GoDependenciesReaderOptions,
  System,
} from "./dependencies-reader/DependenciesReader.types";
import type { createLogger } from "./Logger";
import type { Version__Output as DepsDevVersionOutput } from "./proto/deps_dev/v3/Version";

/**
 * Dependencies output from the deps.dev API
 * Corrected to match the actual output from the API, because the generated types are incorrect
 */
export type VersionOutput = Omit<DepsDevVersionOutput, "versionKey"> & {
  version_key: DepsDevVersionOutput["versionKey"];
};

/**
 * Options to create a DependenciesInfo instance
 */
export interface DependenciesInfoOptions {
  /** Logger instance */
  logger: ReturnType<typeof createLogger>;
  /** Path to the project */
  cwd?: string;
  /** Options for reading the npm dependencies */
  npm?: NpmDependenciesReaderOptions;
  /** Options for reading the maven dependencies */
  maven?: MavenDependenciesReaderOptions;
  /** Options for reading the python dependencies */
  python?: PythonDependenciesReaderOptions;
  /** Options for reading the go dependencies */
  go?: GoDependenciesReaderOptions;
  /** Whether to request for transitive dependencies or not */
  onlyDirect: boolean;
  /** Whether to request for transitive dependencies of production dependencies or not */
  production: boolean;
  /** Whether to request for transitive dependencies of development dependencies or not */
  development: boolean;
}

/** Project direct dependencies */
export type DirectDependencies = DependencyId[];

/**
 * Information about a dependency
 */
export interface DependencyInfo {
  /** Dependency unique id, including the system, name and version */
  id: DependencyId;
  /** The system where the dependency is defined */
  system: System;
  /** The name of the dependency */
  name: string;
  /** The version of the dependency */
  version?: string;
  /** The version of the dependency after resolving semver, etc */
  resolvedVersion?: string;
  /** List of dependencies of this dependency */
  dependencies: DependencyUniqueProps[];
  /** List of licenses of the dependency */
  licenses: string[];
  /** Whether the dependency is direct or not */
  direct: boolean;
  /** Whether the dependency is production or not */
  production: boolean;
  /** Whether the dependency is development or not */
  development: boolean;
  /** List of direct dependencies from which this one is dependant */
  ancestors: DependencyId[];
  /** List of files containing the dependency declaration of the ancestors */
  origins: string[];
  /** List of errors found when retrieving the dependency information */
  errors: Error[];
  /** List of warnings found when reading the dependency information */
  warnings: string[];
}

/**
 * Result of the getDependenciesInfo method
 */
export type GetDependenciesInfoResult = DependencyInfo[];

/** Map of dependencies information, used to store the dependencies information in order to improve the performance of the getDependenciesInfo method */
export type DependenciesMap = Record<DependencyId, DependencyInfo>;

/**
 * Information about a module requested to the deps.dev API
 */
export interface DepsDevModulesInfo {
  [key: DependencyId]: DependencyUniqueProps &
    Pick<VersionOutput, "licenses"> & {
      error?: Error;
      resolvedVersion?: string;
      requestAncestor?: DependencyId;
    };
}

/**
 * Information about module dependencies requested to the deps.dev API
 */
export interface DepsDevDependenciesInfo {
  [key: DependencyId]: DependencyUniqueProps & {
    dependencies: (DependencyUniqueProps & {
      id: DependencyId;
      direct: boolean;
    })[];
    error?: Error;
    resolvedVersion?: string;
  };
}
