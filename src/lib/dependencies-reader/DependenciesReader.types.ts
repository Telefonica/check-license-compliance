// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

import type { createLogger } from "../Logger";

/**
 * Supported systems
 */
export type System = "NPM" | "MAVEN" | "PYPI" | "GO"; // cspell:disable-line

export const baseSystemDependenciesOptionsSchema = z.object({
  includeFiles: z.array(z.string()).optional(),
  excludeFiles: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
  excludeModules: z.array(z.string()).optional(),
  extraModules: z.array(z.string()).optional(),
  developmentFiles: z.array(z.string()).optional(),
});

/**
 * Options to pass to the BaseSystemDependenciesReader when creating a new instance for a system
 */
export interface BaseSystemDependenciesReaderOptions {
  /** includeFiles option to use when it is undefined */
  defaultInclude?: string[];
  /** excludeFiles option to use when it is undefined */
  defaultExclude?: string[];
  /** developmentFiles option to use when it is undefined */
  defaultDevelopment?: string[];
  /** The system to read the dependencies */
  system: System;
}

/**
 * Options for reading system dependencies
 */
export type SystemDependenciesOptions = z.infer<
  typeof baseSystemDependenciesOptionsSchema
>;

export const npmDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

/**
 * Options for reading npm dependencies
 */
export type NpmDependenciesReaderOptions = z.infer<
  typeof npmDependenciesReaderOptionsSchema
>;

export const mavenDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

/**
 * Options for reading maven dependencies
 **/
export type MavenDependenciesReaderOptions = z.infer<
  typeof mavenDependenciesReaderOptionsSchema
>;

export const pythonDependenciesReaderOptionsSchema = z.object({
  ...baseSystemDependenciesOptionsSchema.shape,
  recursiveRequirements: z.boolean().optional(),
});

/**
 * Options for reading python dependencies
 */
export type PythonDependenciesReaderOptions = z.infer<
  typeof pythonDependenciesReaderOptionsSchema
>;

export const goDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

/**
 * Options for reading go dependencies
 */
export type GoDependenciesReaderOptions = z.infer<
  typeof goDependenciesReaderOptionsSchema
>;

/**
 * Key to access system configurations for each different system
 */
export type SystemConfigKey = "npm" | "maven" | "python" | "go";

/**
 * Options for reading dependencies by system
 */
export interface OptionsBySystem {
  /** Options for reading npm dependencies */
  npm?: NpmDependenciesReaderOptions;
  /** Options for reading maven dependencies */
  maven?: MavenDependenciesReaderOptions;
  /** Options for reading python dependencies */
  python?: PythonDependenciesReaderOptions;
  /** Options for reading go dependencies */
  go?: GoDependenciesReaderOptions;
}

/**
 * Dependency ID, in the format system:name:version
 */
export type DependencyId = string;

/**
 * Structure of a package.json file
 */
export interface NpmPackageJson {
  /** Production dependencies */
  dependencies?: Record<string, string>;
  /** Development dependencies */
  devDependencies?: Record<string, string>;
}

/**
 * A Maven POM dependency definition
 */
export interface MavenPomDependency {
  /** The group id of the dependency */
  groupId?: string;
  /** The artifact id of the dependency */
  artifactId?: string;
  /** The version of the dependency */
  version?: string;
  /** The scope of the dependency */
  scope?: "compile" | "provided" | "runtime" | "test";
}

/**
 * Structure of a pom.xml file
 */
export interface MavenPom {
  project: {
    properties?: Record<string, string>;
    dependencies?: {
      dependency: MavenPomDependency[] | MavenPomDependency;
    };
  };
}

/**
 * Base options for a system dependencies reader
 */
export interface SystemDependenciesReaderOptions<
  T extends SystemDependenciesOptions,
> {
  /** The logger instance */
  logger: ReturnType<typeof createLogger>;
  /** The current working directory */
  cwd?: string;
  /** Whether to read production dependencies or not */
  production: boolean;
  /** Whether to read development dependencies or not */
  development: boolean;
  /** The specific options for the system */
  options?: T;
}

/**
 * Options for the class reading dependencies from all systems
 */
export interface DependenciesReaderOptions {
  /** The logger instance */
  logger: ReturnType<typeof createLogger>;
  /** The current working directory */
  cwd?: string;
  /** Specific options for the NPM system */
  npm?: NpmDependenciesReaderOptions;
  /** Specific options for the MAVEN system */
  maven?: MavenDependenciesReaderOptions;
  /** Specific options for the PYTHON system */
  python?: PythonDependenciesReaderOptions;
  /** Specific options for the GO system */
  go?: GoDependenciesReaderOptions;
  /** Whether to read production dependencies or not */
  production: boolean;
  /** Whether to read development dependencies or not */
  development: boolean;
}

/** Properties identifying a dependency, no matter the version */
export interface DependencyNameUniqueProps {
  /** The system where the dependency is defined */
  system: System;
  /** The name of the dependency */
  name: string;
}

/** Properties identifying a dependency, including the version */
export type DependencyUniqueProps = DependencyNameUniqueProps & {
  /** The version of the dependency */
  version?: string;
  /** The resolved version of the dependency */
  resolvedVersion?: string;
};

/** A dependency declaration */
export type DependencyDeclaration = DependencyUniqueProps & {
  /** The unique dependency id */
  id: DependencyId;
  /** Whether the dependency is a production one */
  production: boolean;
  /** Whether the dependency is a development one */
  development: boolean;
  /** The file path where the dependency is declared */
  origin: string;
};

/**
 * Interface for reading dependencies from different systems
 */
export interface DependenciesReader {
  /** Read dependencies from a file and return corresponding dependency declarations */
  readFileDependencies(
    filePath: string,
    isDevelopment: boolean,
  ): Promise<DependencyDeclaration[]>;
  /** Read all files and return corresponding dependency declarations */
  readDependencies(): Promise<DependencyDeclaration[]>;
}
