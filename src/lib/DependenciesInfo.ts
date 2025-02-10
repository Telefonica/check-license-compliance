import path from "node:path";

import grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import PQueue from "p-queue";

import { DirectDependenciesReader } from "./dependencies-reader/DependenciesReader.js";
import type {
  DependencyDeclaration,
  DependencyUniqueProps,
  DependencyId,
  DependencyDeclarationUniqueProps,
  DependencyNameUniqueProps,
  System,
} from "./dependencies-reader/DependenciesReader.types";
import {
  getDependencyId,
  getDependencyName,
  isValidVersion,
} from "./dependencies-reader/Helpers.js";
import type {
  DependenciesInfoOptions,
  GetDependenciesInfoResult,
  DirectDependencies,
  DepsDevModulesInfo,
  DepsDevDependenciesInfo,
  VersionOutput,
} from "./DependenciesInfo.types";
import { ROOT_PATH } from "./Paths.js";
import type { ProtoGrpcType } from "./proto/api";
import type { Dependencies__Output as DependenciesOutput } from "./proto/deps_dev/v3/Dependencies";
import type { GetPackageRequest } from "./proto/deps_dev/v3/GetPackageRequest.js";
import type { GetVersionRequest } from "./proto/deps_dev/v3/GetVersionRequest";
import type { InsightsClient } from "./proto/deps_dev/v3/Insights";
import type { Package__Output as PackageOutput } from "./proto/deps_dev/v3/Package.js";

const PROTOS_PATH = path.join(ROOT_PATH, "proto");
const DEPS_DEV_PATH = path.join(PROTOS_PATH, "deps.dev");
const API_PROTO_PATH = path.join(DEPS_DEV_PATH, "api", "v3", "api.proto");
const API_PROTO_DIRS = [path.join(DEPS_DEV_PATH, "submodules", "googleapis")];

const DEPS_DEV_URL = "api.deps.dev:443";

/**
 * Get the dependencies information from the deps.dev API
 */
export class DependenciesInfo {
  private _logger: DependenciesInfoOptions["logger"];
  private _depsDevInsightsClient!: InsightsClient;
  private _queue = new PQueue({ concurrency: 500 });
  private _depsDevModulesInfo: DepsDevModulesInfo = {};
  private _depsDevDependenciesInfo: DepsDevDependenciesInfo = {};
  private _requestedModules: DependencyId[] = [];
  private _directDependencies: DirectDependencies = [];
  private _directDevDependencies: DirectDependencies = [];
  private _directProdDependencies: DirectDependencies = [];
  private _dependenciesInfo: GetDependenciesInfoResult = [];
  private _projectDependenciesReader: DirectDependenciesReader;
  private _errors: Error[] = [];
  private _warnings: string[] = [];

  constructor({
    logger,
    cwd,
    npm,
    maven,
    python,
    go,
  }: DependenciesInfoOptions) {
    this._logger = logger;
    this._initGrpcClient();
    this._projectDependenciesReader = new DirectDependenciesReader({
      logger,
      cwd,
      npm,
      maven,
      python,
      go,
    });
  }

  private _getRPCDeadline() {
    return new Date(Date.now() + 10000);
  }

  /**
   * Initialize the deps.dev API gRPC client
   */
  private _initGrpcClient() {
    this._logger.silly("Initializing deps.dev API gRPC client", {
      protoLoader,
    });
    const protoDefinition = protoLoader.loadSync(API_PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      // cspell:ignore oneofs
      oneofs: true,
      includeDirs: API_PROTO_DIRS,
    });
    const proto = (
      grpc.loadPackageDefinition(protoDefinition) as unknown as ProtoGrpcType
    ).deps_dev.v3;

    this._depsDevInsightsClient = new proto.Insights(
      DEPS_DEV_URL,
      grpc.credentials.createSsl(),
    );
  }

  private async _waitForQueueToFinish() {
    await new Promise((resolve: (value: void) => void) => {
      this._queue.onIdle().then(() => {
        this._logger.debug("Tasks queue is empty");
        resolve();
      });
    });
  }

  private _clearCache() {
    this._depsDevModulesInfo = {};
    this._depsDevDependenciesInfo = {};
    this._dependenciesInfo = [];
    this._directDependencies = [];
    this._directDevDependencies = [];
    this._directProdDependencies = [];
    this._requestedModules = [];
    this._errors = [];
    this._warnings = [];
  }

  private async _readProjectDependencies(): Promise<
    DependencyDeclaration[] | void
  > {
    return this._queue.add(async () => {
      const dependencies =
        await this._projectDependenciesReader.getDependencies();
      dependencies.forEach((dependency) => {
        // NOTE: Store each local dependency type in a different array for easier access later to improve performance
        if (dependency.production) {
          this._directProdDependencies.push(dependency.id);
        }
        if (dependency.development) {
          this._directDevDependencies.push(dependency.id);
        }
        this._directDependencies.push(dependency.id);
      });
      return dependencies;
    });
  }

  private async _requestModuleVersions(
    { system, name }: DependencyNameUniqueProps,
    retry = 0,
  ): Promise<PackageOutput> {
    const id = getDependencyName({
      system,
      name,
    });
    return new Promise((resolve, reject) => {
      const requestData = {
        package_key: {
          system,
          name,
        },
        // NOTE: The type is not correct in the proto. It expects a "packageKey" object, while the real key is "package_key"
      } as unknown as GetPackageRequest;

      this._logger.debug(`Requesting versions of ${id}`);

      this._depsDevInsightsClient.GetPackage(
        requestData,
        { deadline: this._getRPCDeadline() },
        (error, response) => {
          if (error || !response) {
            // Detect if error is due to deadline exceeded, then retry
            if (error?.code === grpc.status.DEADLINE_EXCEEDED && retry < 3) {
              this._logger.warn(
                `Retrying versions request of ${id} due to deadline exceeded. Retry ${retry + 1}/3`,
              );
              this._requestModuleVersions({ system, name }, retry + 1)
                .then(resolve)
                .catch(reject);
              return;
            }
            this._logger.error(`Error requesting versions of ${id}`, error);
            reject(error);
            return;
          }
          resolve(response);
        },
      );
    });
  }

  private async _getModuleDefaultVersion({
    system,
    name,
  }: DependencyNameUniqueProps): Promise<string | undefined> {
    const id = getDependencyName({
      system,
      name,
    });
    const moduleVersions = await this._requestModuleVersions({ system, name });
    this._logger.silly(
      `Response received for versions of ${id}`,
      moduleVersions,
    );
    const defaultVersion = moduleVersions.versions.find(
      // @ts-expect-error The type is not correct in the proto, the real key is "is_default", while the type is "isDefault"
      (version) => version.is_default,
    );

    //@ts-expect-error The type defines "versionKey" but the real key is "version_key"
    return defaultVersion?.version_key?.version;
  }

  private async _requestModuleVersionInfo(
    { system, name, version }: DependencyUniqueProps,
    retry = 0,
  ): Promise<VersionOutput> {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    return new Promise((resolve, reject) => {
      const requestData = {
        version_key: {
          system,
          name,
          version,
        },
        // NOTE: The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
      } as unknown as GetVersionRequest;

      this._logger.debug(`Requesting info of ${id}`);

      this._depsDevInsightsClient.GetVersion(
        requestData,
        { deadline: this._getRPCDeadline() },
        (error, response) => {
          if (error || !response) {
            // Detect if error is due to deadline exceeded, then retry
            if (error?.code === grpc.status.DEADLINE_EXCEEDED && retry < 3) {
              this._logger.warn(
                `Retrying info request of ${id} due to deadline exceeded. Retry ${retry + 1}/3`,
              );
              this._requestModuleVersionInfo(
                { system, name, version },
                retry + 1,
              )
                .then(resolve)
                .catch(reject);
              return;
            }
            this._logger.error(`Error requesting info of ${id}`, error);
            reject(error);
            return;
          }
          this._logger.silly(`Response received for info of ${id}`, response);
          // NOTE: The type is not correct in the proto. The real key is "version_key", while the type is "versionKey". This is corrected in the VersionOutput type
          resolve(response as unknown as VersionOutput);
        },
      );
    });
  }

  private async _requestModuleDependencies(
    { system, name, version }: DependencyUniqueProps,
    retry = 0,
  ): Promise<DependenciesOutput> {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    return new Promise((resolve, reject) => {
      const requestData = {
        version_key: {
          system,
          name,
          version,
        },
        // NOTE: The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
      } as unknown as GetVersionRequest;

      this._logger.debug(`Requesting dependencies of ${id}`);

      this._depsDevInsightsClient.GetDependencies(
        requestData,
        { deadline: this._getRPCDeadline() },
        (error, response) => {
          if (error || !response) {
            // Detect if error is due to deadline exceeded, then retry
            if (error?.code === grpc.status.DEADLINE_EXCEEDED && retry < 3) {
              this._logger.warn(
                `Retrying dependencies request of ${id} due to deadline exceeded. Retry ${retry + 1}/3`,
              );
              this._requestModuleDependencies(
                { system, name, version },
                retry + 1,
              )
                .then(resolve)
                .catch(reject);
              return;
            }
            this._logger.error(`Error requesting dependencies of ${id}`, error);
            reject(error);
            return;
          }
          this._logger.silly(
            `Response received for dependencies of ${id}`,
            response,
          );
          resolve(response);
        },
      );
    });
  }

  private async _requestModuleAndDependenciesInfo({
    system,
    name,
    version,
  }: DependencyDeclarationUniqueProps) {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    if (
      this._requestedModules.includes(
        getDependencyId({ system, name, version }),
      )
    ) {
      this._logger.silly(
        `The module ${id} has already been requested. Skipping`,
      );
      return;
    }

    this._requestedModules.push(id);
    this._logger.debug(`Requesting module and dependencies info for ${id}`);

    const versionIsValid = isValidVersion(system, version);
    if (!versionIsValid) {
      this._logger.debug(
        `Invalid version "${version}" while requesting info of ${id}. Searching the default version available for use it`,
      );
    }

    // TODO: Avoid two different invalid versions requesting always the default version

    const versionToRequest = versionIsValid
      ? version
      : await this._queue.add(async () => {
          try {
            const moduleDefaultVersion = await this._getModuleDefaultVersion({
              system,
              name,
            });
            if (!moduleDefaultVersion) {
              const message = `No default version found to request data of ${id}`;
              this._logger.error(message);
              throw new Error(message);
            }
            return moduleDefaultVersion;
          } catch (error) {
            const err = error as Error;
            const errorToReport = {
              ...err,
              message: `Error requesting module default version: ${err.message}`,
            };
            this._depsDevModulesInfo[id] = {
              system,
              name,
              version,
              licenses: [],
              error: errorToReport,
            };
            this._depsDevDependenciesInfo[id] = {
              system,
              name,
              version,
              dependencies: [],
              error: errorToReport,
            };
          }
        });

    if (!versionToRequest) {
      return;
    }

    this._queue.add(async () => {
      try {
        const moduleInfo = await this._requestModuleVersionInfo({
          system,
          name,
          version: versionToRequest,
        });
        this._depsDevModulesInfo[id] = {
          system: moduleInfo.version_key!.system as System,
          name: moduleInfo.version_key!.name,
          version,
          resolvedVersion: versionToRequest,
          licenses: moduleInfo.licenses,
        };
      } catch (error) {
        const err = error as Error;
        this._depsDevModulesInfo[id] = {
          system,
          name,
          version,
          resolvedVersion: versionToRequest,
          licenses: [],
          error: {
            ...err,
            message: `Error requesting module info: ${err.message}`,
          },
        };
      }
    });

    this._queue.add(async () => {
      try {
        const dependencies = await this._requestModuleDependencies({
          system,
          name,
          version: versionToRequest,
        });

        this._depsDevDependenciesInfo[id] = {
          system,
          name,
          version,
          resolvedVersion: versionToRequest,
          dependencies: dependencies.nodes
            .map((node) => {
              // @ts-expect-error The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
              const dependencyInfo = node.version_key;
              if (!dependencyInfo) {
                this._logger.error(
                  `No dependency info found for ${id}`,
                  node.errors,
                );
                return;
              }
              if (
                dependencyInfo.system !== system ||
                dependencyInfo.name !== name
              ) {
                return {
                  id: getDependencyId(dependencyInfo),
                  system: dependencyInfo.system,
                  name: dependencyInfo.name,
                  version: dependencyInfo.version,
                  direct: node.relation === "DIRECT",
                };
              }
            })
            .filter((d) => !!d),
        };

        dependencies.nodes.forEach((dependency) => {
          // @ts-expect-error The type is not correct in the proto. The real key is "version_key", while the type is "versionKey"
          const dependencyInfo = dependency.version_key;
          if (
            dependencyInfo.system !== system ||
            dependencyInfo.name !== name
          ) {
            this._queue.add(async () => {
              await this._requestModuleAndDependenciesInfo({
                system: dependencyInfo.system,
                name: dependencyInfo.name,
                version: dependencyInfo.version,
              });
            });
          }
        });
      } catch (error) {
        const err = error as Error;
        this._depsDevDependenciesInfo[id] = {
          system,
          name,
          version,
          resolvedVersion: versionToRequest,
          dependencies: [],
          error: {
            ...err,
            message: `Error requesting dependencies: ${err.message}`,
          },
        };
      }
    });
  }

  private _requestDependenciesInfo(
    projectDependencies: DependencyDeclaration[],
  ) {
    this._logger.info("Getting dependencies info from deps.dev API");
    projectDependencies.forEach((dependency) => {
      this._requestModuleAndDependenciesInfo(dependency);
    });
  }

  private _getAncestors(dependency: DependencyId) {
    let result: string[] = [];
    result = this._directDependencies.filter((directDependency) => {
      const directDependencyInfo =
        this._depsDevDependenciesInfo[directDependency];
      if (!directDependencyInfo) {
        throw new Error(
          `No dependencies info found for direct dependency ${directDependency}. This should not happen`,
        );
      }
      return directDependencyInfo.dependencies.some((dependencyInfo) => {
        return dependencyInfo.id === dependency;
      });
    });
    if (!result.length) {
      this._logger.warn(
        `No ancestors found for dependency ${dependency} in direct dependencies. Searching traversing the dependencies tree`,
      );
      const searchAncestors = (dependencyId: DependencyId): string[] => {
        const ancestors = Object.keys(this._depsDevDependenciesInfo).filter(
          (id) => {
            return this._depsDevDependenciesInfo[id].dependencies.some(
              (dependencyInfo) => {
                return dependencyInfo.id === dependencyId;
              },
            );
          },
        );
        return ancestors
          .map((ancestor) => {
            if (this._directDependencies.includes(ancestor)) {
              return ancestor;
            }
            return searchAncestors(ancestor);
          })
          .flat();
      };
      result = searchAncestors(dependency);
    }
    return Array.from(new Set(result));
  }

  private _fillDependenciesInfo(projectDependencies: DependencyDeclaration[]) {
    this._logger.info("Preparing dependencies info");

    this._logger.silly("Retrieved information", {
      directDependencies: this._directDependencies,
      directProdDependencies: this._directProdDependencies,
      directDevDependencies: this._directDevDependencies,
      depsDevModulesInfo: this._depsDevModulesInfo,
      depsDevDependenciesInfo: this._depsDevDependenciesInfo,
    });

    Object.keys(this._depsDevModulesInfo).forEach((id) => {
      const moduleInfo = this._depsDevModulesInfo[id];
      const dependenciesInfo = this._depsDevDependenciesInfo[id];

      if (!dependenciesInfo) {
        throw new Error(
          `No dependencies info found for dependency ${id}. This should not happen`,
        );
      }

      const isDirect = this._directDependencies.includes(id);
      const ancestors = isDirect ? [] : this._getAncestors(id);

      const isProduction = isDirect
        ? this._directProdDependencies.includes(id)
        : ancestors.some((ancestor) =>
            this._directProdDependencies.includes(ancestor),
          );
      const isDevelopment = isDirect
        ? this._directDevDependencies.includes(id)
        : ancestors.some((ancestor) =>
            this._directDevDependencies.includes(ancestor),
          );

      const origins = Array.from(
        new Set(
          isDirect
            ? projectDependencies
                .filter((dependency) => {
                  return dependency.id === id;
                })
                .map((dependency) => {
                  return dependency.origin;
                })
            : projectDependencies
                .filter((dependency) => {
                  return ancestors.includes(dependency.id);
                })
                .map((dependency) => {
                  return dependency.origin;
                }),
        ),
      );

      const errors = [];
      if (moduleInfo.error) {
        errors.push(moduleInfo.error);
      }
      if (dependenciesInfo.error) {
        errors.push(dependenciesInfo.error);
      }
      const warnings = [];
      if (!isDirect && !ancestors.length) {
        this._logger.warn(`Ancestor not found for dependency ${id}`);
        warnings.push("Ancestor not found");
      }
      if (!isDirect && !isProduction && !isDevelopment) {
        this._logger.warn(`Dependency ${id} is not production or development`);
        warnings.push("Not production nor development");
      }

      this._dependenciesInfo.push({
        id,
        system: moduleInfo.system,
        name: moduleInfo.name,
        version: moduleInfo.version,
        resolvedVersion: moduleInfo.resolvedVersion,
        licenses: moduleInfo.licenses,
        direct: isDirect,
        production: isProduction,
        development: isDevelopment,
        dependencies: dependenciesInfo.dependencies,
        ancestors: ancestors,
        origins,
        errors,
        warnings,
      });
    });
  }

  private _getErrors() {
    this._errors = this._dependenciesInfo.reduce((errors, dependencyInfo) => {
      return errors.concat(
        dependencyInfo.errors.map((error) => ({
          ...error,
          message: `${dependencyInfo.id}: ${error.message}`,
        })),
      );
    }, [] as Error[]);
  }

  private _getWarnings() {
    this._warnings = this._dependenciesInfo.reduce(
      (warnings, dependencyInfo) => {
        return warnings.concat(
          dependencyInfo.warnings.map(
            (warning) => `${dependencyInfo.id}: ${warning}`,
          ),
        );
      },
      [] as string[],
    );
  }

  /**
   * Look for the dependency files, read them and return the dependencies information using the deps.dev API
   * If any other execution is in progress, it waits for it to finish. Then, it clears the cache and starts the new execution
   */
  public async getDependencies(): Promise<GetDependenciesInfoResult> {
    await this._waitForQueueToFinish();
    this._clearCache();

    const projectDependencies = await this._readProjectDependencies();
    // NOTE: Defensively check if the dependencies are not undefined just in case the queue is cancelled.
    if (projectDependencies) {
      this._requestDependenciesInfo(projectDependencies);
    }
    await this._waitForQueueToFinish();
    if (projectDependencies) {
      this._fillDependenciesInfo(projectDependencies);
    }
    this._getErrors();
    this._getWarnings();
    this._logger.info(
      `Retrieved information about ${this._dependenciesInfo.length} dependencies`,
    );
    this._logger.debug("Dependencies info", {
      dependencies: this._dependenciesInfo,
    });
    return this._dependenciesInfo;
  }

  public get errors() {
    return this._errors;
  }

  public get warnings() {
    return this._warnings;
  }
}
