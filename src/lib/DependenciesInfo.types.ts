import type {
  DependencyUniqueProps,
  DependencyDeclarationUniqueProps,
  DependencyId,
  NpmDependenciesReaderOptions,
  MavenDependenciesReaderOptions,
  PythonDependenciesReaderOptions,
  GoDependenciesReaderOptions,
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

export interface DependenciesInfoOptions {
  logger: ReturnType<typeof createLogger>;
  cwd?: string;
  npm?: NpmDependenciesReaderOptions;
  maven?: MavenDependenciesReaderOptions;
  python?: PythonDependenciesReaderOptions;
  go?: GoDependenciesReaderOptions;
}

export type DirectDependencies = DependencyId[];

export interface DependencyInfo {
  id: DependencyId;
  system: string;
  name: string;
  version?: string;
  resolvedVersion?: string;
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

export interface DepsDevModulesInfo {
  [key: DependencyId]: DependencyDeclarationUniqueProps &
    Pick<VersionOutput, "licenses"> & {
      error?: Error;
      resolvedVersion?: string;
    };
}

export interface DepsDevDependenciesInfo {
  [key: DependencyId]: DependencyDeclarationUniqueProps & {
    dependencies: (DependencyUniqueProps & {
      id: DependencyId;
      direct: boolean;
    })[];
    error?: Error;
    resolvedVersion?: string;
  };
}
