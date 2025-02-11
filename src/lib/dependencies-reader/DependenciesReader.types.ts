import { z } from "zod";

import type { createLogger } from "../Logger";

// cspell:disable-next-line
export type System = "NPM" | "MAVEN" | "PYPI" | "GO";

export const baseSystemDependenciesOptionsSchema = z.object({
  includeFiles: z.array(z.string()).optional(),
  excludeFiles: z.array(z.string()).optional(),
});

export interface BaseSystemDependenciesReaderOptions {
  defaultInclude?: string[];
  defaultExclude?: string[];
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

export const pythonDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

export type PythonDependenciesReaderOptions = z.infer<
  typeof pythonDependenciesReaderOptionsSchema
>;

export const goDependenciesReaderOptionsSchema =
  baseSystemDependenciesOptionsSchema;

export type GoDependenciesReaderOptions = z.infer<
  typeof goDependenciesReaderOptionsSchema
>;

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
  options?: T;
}

export interface DependenciesReaderOptions {
  logger: ReturnType<typeof createLogger>;
  cwd?: string;
  npm?: NpmDependenciesReaderOptions;
  maven?: MavenDependenciesReaderOptions;
  python?: PythonDependenciesReaderOptions;
  go?: GoDependenciesReaderOptions;
}

export interface DependencyNameUniqueProps {
  system: System;
  name: string;
}

export type DependencyDeclarationUniqueProps = DependencyNameUniqueProps & {
  version?: string;
};

export type DependencyUniqueProps = DependencyDeclarationUniqueProps & {
  version: string;
};

export interface DependencyDeclaration
  extends DependencyDeclarationUniqueProps {
  id: DependencyId;
  production: boolean;
  development: boolean;
  origin: string;
}

export interface DependenciesReader {
  getDependencies(): Promise<DependencyDeclaration[]>;
}
