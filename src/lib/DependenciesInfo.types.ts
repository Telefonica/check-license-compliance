import type {
  DependencyUniqueProps,
  DependencyId,
} from "./DependenciesReader.types";
import type { createLogger } from "./Logger";
import type { Version__Output as DepsDevVersionOutput } from "./proto/deps_dev/v3/Version";

/**
 * Dependencies output from the deps.dev API
 * Corrected to match the actual output from the API, because the generated types are incorrect
 */
export type VersionOutput = Omit<DepsDevVersionOutput, "versionKey"> & {
  version_key: DepsDevVersionOutput["versionKey"];
};

export interface DependenciesInfoOptions {
  logger: ReturnType<typeof createLogger>;
  cwd?: string;
}

export type DirectDependencies = DependencyId[];

export interface DependencyInfo {
  id: DependencyId;
  system: string;
  name: string;
  version: string;
  dependencies: DependencyUniqueProps[];
  licenses: string[];
  direct: boolean;
  production: boolean;
  development: boolean;
  ancestors: DependencyId[];
  origins: string[];
  errors: Error[];
  warnings: string[];
}

export type GetDependenciesInfoResult = DependencyInfo[];
export type DependenciesMap = Record<DependencyId, DependencyInfo>;

export interface DepsDevDependencyNode {
  version_key: DependencyUniqueProps;
  relation: "SELF" | "DIRECT" | "INDIRECT";
  errors: string[];
}

export interface DepsDevPackagesInfo {
  [key: DependencyId]: Pick<VersionOutput, "version_key" | "licenses"> & {
    error?: Error;
  };
}

export interface DepsDevDependenciesInfo {
  [key: DependencyId]: DependencyUniqueProps & {
    dependencies: (DependencyUniqueProps & {
      id: DependencyId;
      direct: boolean;
    })[];
    error?: Error;
  };
}
