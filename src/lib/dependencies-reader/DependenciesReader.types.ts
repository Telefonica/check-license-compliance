// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

import type { createLogger } from "../Logger";

// cspell:disable-next-line
export type System = "NPM" | "MAVEN" | "PYPI" | "GO";

export const baseSystemDependenciesOptionsSchema = z.object({
  includeFiles: z.array(z.string()).optional(),
  excludeFiles: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
  excludeModules: z.array(z.string()).optional(),
  extraModules: z.array(z.string()).optional(),
  developmentFiles: z.array(z.string()).optional(),
});

export interface BaseSystemDependenciesReaderOptions {
  defaultInclude?: string[];
  defaultExclude?: string[];
  defaultDevelopment?: string[];
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

export type NpmDependenciesReaderOptions = z.infer<
  typeof npmDependenciesReaderOptionsSchema
>;

export const mavenDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

export type MavenDependenciesReaderOptions = z.infer<
  typeof mavenDependenciesReaderOptionsSchema
>;

export const pythonDependenciesReaderOptionsSchema = z.object({
  ...baseSystemDependenciesOptionsSchema.shape,
  recursiveRequirements: z.boolean().optional(),
});

export type PythonDependenciesReaderOptions = z.infer<
  typeof pythonDependenciesReaderOptionsSchema
>;

export const goDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

export type GoDependenciesReaderOptions = z.infer<
  typeof goDependenciesReaderOptionsSchema
>;

export type SystemConfigKey = "npm" | "maven" | "python" | "go";

/**
 * Options for reading dependencies by system
 */
export interface OptionsBySystem {
  /**
   * Options for reading npm dependencies
   */
  npm?: NpmDependenciesReaderOptions;
  maven?: MavenDependenciesReaderOptions;
  python?: PythonDependenciesReaderOptions;
  go?: GoDependenciesReaderOptions;
}

/**
 * Dependency ID, in the format system:name:version
 */
export type DependencyId = string;

export interface NpmPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface MavenPomDependency {
  groupId?: string;
  artifactId?: string;
  version?: string;
  scope?: "compile" | "provided" | "runtime" | "test";
}

export interface MavenPom {
  project: {
    properties?: Record<string, string>;
    dependencies?: {
      dependency: MavenPomDependency[] | MavenPomDependency;
    };
  };
}

export interface SystemDependenciesReaderOptions<
  T extends SystemDependenciesOptions,
> {
  logger: ReturnType<typeof createLogger>;
  cwd?: string;
  production: boolean;
  development: boolean;
  options?: T;
}

export interface DependenciesReaderOptions {
  logger: ReturnType<typeof createLogger>;
  cwd?: string;
  npm?: NpmDependenciesReaderOptions;
  maven?: MavenDependenciesReaderOptions;
  python?: PythonDependenciesReaderOptions;
  go?: GoDependenciesReaderOptions;
  production: boolean;
  development: boolean;
}

export interface DependencyNameUniqueProps {
  system: System;
  name: string;
}

export type DependencyUniqueProps = DependencyNameUniqueProps & {
  version?: string;
  resolvedVersion?: string;
};

export type DependencyDeclaration = DependencyUniqueProps & {
  id: DependencyId;
  production: boolean;
  resolvedVersion?: string;
  development: boolean;
  origin: string;
};

export interface DependenciesReader {
  readDependencies(): Promise<DependencyDeclaration[]>;
  readFileDependencies(
    filePath: string,
    isDevelopment: boolean,
  ): Promise<DependencyDeclaration[]>;
}
