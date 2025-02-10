import { z } from "zod";

import type { createLogger } from "../Logger";
import type { System__Output as SystemOutput } from "../proto/deps_dev/v3/System";

export const baseSystemDependenciesOptionsSchema = z.object({
  includeFiles: z.array(z.string()).optional(),
  excludeFiles: z.array(z.string()).optional(),
});

export interface BaseSystemDependenciesReaderOptions {
  defaultInclude?: string[];
  defaultExclude?: string[];
  system: SystemOutput;
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

/**
 * Options for reading dependencies by system
 */
export interface OptionsBySystem {
  /**
   * Options for reading npm dependencies
   */
  npm?: SystemDependenciesOptions;
}

/**
 * Dependency ID, in the format system:name:version
 */
export type DependencyId = string;

export interface NpmPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
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
  npm?: SystemDependenciesOptions;
}

export interface DependencyUniqueProps {
  system: SystemOutput;
  name: string;
  version: string;
}

export interface DependencyDeclaration extends DependencyUniqueProps {
  id: DependencyId;
  production: boolean;
  development: boolean;
  origin: string;
}

export interface DependenciesReader {
  getDependencies(): Promise<DependencyDeclaration[]>;
}
