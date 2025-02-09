import type { createLogger } from "./Logger";
import type { System__Output as SystemOutput } from "./proto/deps_dev/v3/System";

/**
 * Dependency ID, in the format system:name:version
 */
export type DependencyId = string;

export interface NodePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DependenciesReaderOptions {
  logger: ReturnType<typeof createLogger>;
  cwd?: string;
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
