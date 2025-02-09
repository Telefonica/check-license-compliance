import type { ChannelCredentials } from "@grpc/grpc-js";

import type {
  DependencyUniqueProps,
  DependencyId,
} from "./DependenciesReader.types";
import type { createLogger } from "./Logger";

// TODO: Use ts-proto or something similar to generate the deps.dev API types from the proto file

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

export interface DepsDevGetVersionRequest {
  version_key: DependencyUniqueProps;
}

export interface DepsDevGetDependenciesRequest {
  version_key: DependencyUniqueProps;
}

export interface DepsDevDependencyNode {
  version_key: DependencyUniqueProps;
  relation: "SELF" | "DIRECT" | "INDIRECT";
  errors: string[];
}

export interface DepsDevGetDependenciesResponse {
  nodes: DepsDevDependencyNode[];
}

export interface DepsDevPackageInfoResponse {
  version_key: DependencyUniqueProps;
  licenses: string[];
}

export interface DepsDevPackagesInfo {
  [key: DependencyId]: DepsDevPackageInfoResponse & { error?: Error };
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

export interface DepsDevInsightsClient {
  GetVersion: (
    request: DepsDevGetVersionRequest,
    callback: (
      error: Error | null,
      response: DepsDevPackageInfoResponse,
    ) => void,
  ) => void;
  GetDependencies: (
    request: DepsDevGetDependenciesRequest,
    callback: (
      error: Error | null,
      response: DepsDevGetDependenciesResponse,
    ) => void,
  ) => void;
}

export interface DepsDevInsights {
  new (
    url: string,
    credentialsClient: ChannelCredentials,
  ): DepsDevInsightsClient;
}

export interface DepsDevProtoV3 {
  Insights: DepsDevInsights;
}

export interface DepsDevProto {
  deps_dev: {
    v3: DepsDevProtoV3;
  };
}
