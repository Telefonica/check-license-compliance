// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import PQueue from "p-queue";

import { DirectDependenciesReader } from "./dependencies-reader/DependenciesReader.js";
import type {
  DependencyDeclaration,
  DependencyUniqueProps,
  DependencyId,
  DependencyNameUniqueProps,
  System,
  OptionsBySystem,
} from "./dependencies-reader/DependenciesReader.types";
import {
  getDependencyId,
  getDependencyNameWithSystem,
  isValidVersion,
  getDependencyDisplayName,
} from "./dependencies-reader/Helpers.js";
import type {
  DependenciesInfoOptions,
  GetDependenciesInfoResult,
  DirectDependencies,
  DepsDevModulesInfo,
  DepsDevDependenciesInfo,
  VersionOutput,
} from "./DependenciesInfo.types";
import { dependencyIsIgnored } from "./Helpers.js";
import { ROOT_PATH } from "./Paths.js";
import type { ProtoGrpcType } from "./proto/api";
import type { Dependencies__Output as DependenciesOutput } from "./proto/deps_dev/v3/Dependencies";
import type { GetPackageRequest } from "./proto/deps_dev/v3/GetPackageRequest.js";
import type { GetVersionRequest } from "./proto/deps_dev/v3/GetVersionRequest";
import type { InsightsClient } from "./proto/deps_dev/v3/Insights";
import type { Package__Output as PackageOutput } from "./proto/deps_dev/v3/Package.js";

/** Path to the proto files */
const PROTOS_PATH = path.join(ROOT_PATH, "proto");
/** Path to the deps.dev proto files */
const DEPS_DEV_PATH = path.join(PROTOS_PATH, "deps.dev");
/** Path to the deps.dev API proto file */
const API_PROTO_PATH = path.join(DEPS_DEV_PATH, "api", "v3", "api.proto");
/** Paths to include in the proto loader when loading the deps.dev API proto file */
const API_PROTO_DIRS = [path.join(DEPS_DEV_PATH, "submodules", "googleapis")];
/** The deps.dev API url */
const DEPS_DEV_URL = "api.deps.dev:443";

/**
 * Read the dependencies information from the project dependencies and the deps.dev API
 */
export class DependenciesInfo {
  private _logger: DependenciesInfoOptions["logger"];
  private _depsDevInsightsClient!: InsightsClient;
  private _queue = new PQueue({ concurrency: 500 });
  private _depsDevModulesInfo: DepsDevModulesInfo = {};
  private _depsDevDependenciesInfo: DepsDevDependenciesInfo = {};
  private _requestedModules: DependencyId[] = [];
  private _ignoredModules: DependencyId[] = [];
  private _directDependencies: DirectDependencies = [];
  private _directDevDependencies: DirectDependencies = [];
  private _directProdDependencies: DirectDependencies = [];
  private _dependenciesInfo: GetDependenciesInfoResult = [];
  private _projectDependenciesReader: DirectDependenciesReader;
  private _getDependenciesPromise?: Promise<GetDependenciesInfoResult> | null;
  private _errors: Error[] = [];
  private _warnings: string[] = [];
  private _moduleVersionRequests: Record<string, Promise<string | undefined>> =
    {};
  private _parents: Record<DependencyId, DependencyId[]> = {};
  private _onlyDirect: boolean;
  private _production: boolean;
  private _development: boolean;
  private _optionsBySystem: OptionsBySystem;

  /**
   * Create a new instance of the DependenciesInfo
   * @param options The options to create the DependenciesInfo instance
   */
  constructor({
    logger,
    cwd,
    npm,
    maven,
    python,
    go,
    onlyDirect,
    production,
    development,
  }: DependenciesInfoOptions) {
    this._optionsBySystem = {
      npm,
      maven,
      python,
      go,
    };
    this._logger = logger;
    this._initGrpcClient();
    this._projectDependenciesReader = new DirectDependenciesReader({
      logger,
      cwd,
      npm,
      maven,
      python,
      go,
      production,
      development,
    });
    this._onlyDirect = onlyDirect;
    this._production = production;
    this._development = development;
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

  /**
   * Clear the cache of the instance, enabling to run again the read process
   */
  private _clearCache() {
    this._depsDevModulesInfo = {};
    this._depsDevDependenciesInfo = {};
    this._dependenciesInfo = [];
    this._directDependencies = [];
    this._directDevDependencies = [];
    this._directProdDependencies = [];
    this._requestedModules = [];
    this._ignoredModules = [];
    this._errors = [];
    this._warnings = [];
    this._moduleVersionRequests = {};
    this._parents = {};
  }

  /**
   * Read the project dependencies from the project dependencies reader
   * @returns Array of dependency declarations found in the project files
   */
  private async _readProjectDependencies(): Promise<
    DependencyDeclaration[] | void
  > {
    const dependencies =
      await this._projectDependenciesReader.readDependencies();
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
  }

  /**
   * Request the versions of a module to the deps.dev API
   * @param dependencyData The data of the dependency to request the versions
   * @param retry Current retry number. When it reaches 3, it stops retrying
   * @returns The response of the API with the versions of the module
   */
  private _requestModuleVersions(
    { system, name }: DependencyNameUniqueProps,
    retry = 0,
  ): Promise<PackageOutput> {
    const id = getDependencyNameWithSystem({
      system,
      name,
    });
    return this._queue.add(
      () =>
        new Promise((resolve, reject) => {
          const requestData = {
            package_key: {
              system,
              name,
            },
            // NOTE: The type is not correct in the proto. It expects a "packageKey" object, while the real key is "package_key"
          } as unknown as GetPackageRequest;

          this._logger.verbose(`Requesting versions of ${id}`);

          this._depsDevInsightsClient.GetPackage(
            requestData,
            { deadline: this._getRPCDeadline() },
            (error, response) => {
              if (error || !response) {
                // Detect if error is due to deadline exceeded, then retry
                if (
                  error?.code === grpc.status.DEADLINE_EXCEEDED &&
                  retry < 3
                ) {
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
              this._logger.silly(
                `Response received for versions of ${id}`,
                response,
              );
              resolve(response);
            },
          );
        }),
    ) as Promise<PackageOutput>;
  }

  /**
   * Returns the default version of a module from the versions available in the deps.dev API
   * @param moduleData The data of the module to get the default version
   * @returns The default version of the module defined in the deps.dev API
   */
  private async _getModuleDefaultVersion({
    system,
    name,
  }: DependencyNameUniqueProps): Promise<string | undefined> {
    const id = getDependencyNameWithSystem({
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

  /**
   * Returns the default version of a module from the cache or requests it to the deps.dev API
   * @param moduleData The data of the module to get the default version
   * @returns The default version of the module defined in the deps.dev API
   */
  private _getModuleDefaultVersionFromCache({
    system,
    name,
  }: DependencyNameUniqueProps): Promise<string | undefined> {
    if (!this._moduleVersionRequests[name]) {
      this._moduleVersionRequests[name] = this._getModuleDefaultVersion({
        system,
        name,
      });
    }
    return this._moduleVersionRequests[name];
  }

  /**
   * Request the information of a module to the deps.dev API, which includes the licenses of the module
   * @param dependencyData The data of the module to request the information
   * @param retry Current retry number. When it reaches 3, it stops retrying
   * @returns The response of the API with the module information
   */
  private _requestModuleVersionInfo(
    { system, name, version }: DependencyUniqueProps,
    retry = 0,
  ): Promise<VersionOutput> {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    return this._queue.add(
      () =>
        new Promise((resolve, reject) => {
          const requestData = {
            version_key: {
              system,
              name,
              version,
            },
            // NOTE: The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
          } as unknown as GetVersionRequest;

          this._logger.verbose(`Requesting info of ${id}`);

          this._depsDevInsightsClient.GetVersion(
            requestData,
            { deadline: this._getRPCDeadline() },
            (error, response) => {
              if (error || !response) {
                // Detect if error is due to deadline exceeded, then retry
                if (
                  error?.code === grpc.status.DEADLINE_EXCEEDED &&
                  retry < 3
                ) {
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
              this._logger.silly(
                `Response received for info of ${id}`,
                response,
              );
              // NOTE: The type is not correct in the proto. The real key is "version_key", while the type is "versionKey". This is corrected in the VersionOutput type
              resolve(response as unknown as VersionOutput);
            },
          );
        }),
    ) as Promise<VersionOutput>;
  }

  /**
   * Request the dependencies of a module to the deps.dev API
   * @param dependencyData The data of the module to request the dependencies
   * @param retry Current retry number. When it reaches 3, it stops retrying
   * @returns The response of the API with the module dependencies
   */
  private _requestModuleDependencies(
    { system, name, version }: DependencyUniqueProps,
    retry = 0,
  ): Promise<DependenciesOutput> {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    return this._queue.add(
      () =>
        new Promise((resolve, reject) => {
          const requestData = {
            version_key: {
              system,
              name,
              version,
            },
            // NOTE: The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
          } as unknown as GetVersionRequest;

          this._logger.verbose(`Requesting dependencies of ${id}`);

          this._depsDevInsightsClient.GetDependencies(
            requestData,
            { deadline: this._getRPCDeadline() },
            (error, response) => {
              if (error || !response) {
                // Detect if error is due to deadline exceeded, then retry
                if (
                  error?.code === grpc.status.DEADLINE_EXCEEDED &&
                  retry < 3
                ) {
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
                this._logger.error(
                  `Error requesting dependencies of ${id}`,
                  error,
                );
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
        }),
    ) as Promise<DependenciesOutput>;
  }

  /**
   * Request the information of a module and its dependencies to the deps.dev API and store it in the instance
   * It requests the dependencies recursively, storing the ancestors of the module
   * In case there are errors requesting the data, it stores objects with the minimal information and the error information
   * These errors can be retrieved later to show them to the user by using the `errors` getter of the instance
   * @param moduleData The data of the module to request the information and dependencies
   * @param options The options to request the module and dependencies info
   *  - isDirect: Whether the module is a direct dependency of the project
   *  - ancestor: The ancestor of the module, if it is not a direct dependency
   *  - development: Whether to request the development dependencies
   *  - production: Whether to request the production dependencies
   */
  private async _requestModuleAndDependenciesInfo(
    { system, name, version, resolvedVersion }: DependencyUniqueProps,
    { isDirect = false, ancestor = "", development = true, production = true },
  ) {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    const ancestorToPass = isDirect ? id : ancestor;
    const ancestorToSet = isDirect ? undefined : ancestor;

    if (this._ignoredModules.includes(id)) {
      this._logger.silly(`The module ${id} is ignored. Skipping`);
      return;
    }

    if (
      dependencyIsIgnored(
        { system, name, version, resolvedVersion, id },
        this._optionsBySystem,
      )
    ) {
      this._logger.warn(
        `The module ${id} is ignored. Skipping request of info and dependencies`,
      );
      this._ignoredModules.push(id);
      return;
    }

    if (this._requestedModules.includes(id)) {
      this._logger.silly(
        `The module ${id} has already been requested. Skipping`,
      );
      return;
    }

    this._requestedModules.push(id);
    this._logger.verbose(`Requesting module and dependencies info for ${id}`);

    const versionToCheck = resolvedVersion || version;

    const versionIsValid = isValidVersion(system, versionToCheck);
    if (!versionIsValid) {
      this._logger.debug(
        `Invalid version "${version}" while requesting info of ${id}. Searching the default version available for use it`,
      );
    }

    const getModuleDefaultVersion = async () => {
      try {
        const moduleDefaultVersion =
          await this._getModuleDefaultVersionFromCache({
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
          requestAncestor: ancestorToSet,
        };
        this._depsDevDependenciesInfo[id] = {
          system,
          name,
          version,
          dependencies: [],
          error: errorToReport,
        };
      }
    };

    const versionToRequest = versionIsValid
      ? versionToCheck
      : await getModuleDefaultVersion();

    if (!versionToRequest) {
      return;
    }

    const getModuleInfo = async () => {
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
          requestAncestor: ancestorToSet,
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
    };

    const getDependenciesInfo = async () => {
      try {
        const skipRequestDependencies =
          this._onlyDirect ||
          (isDirect && development && !this._development) ||
          (isDirect && production && !this._production);

        const dependencies = !skipRequestDependencies
          ? await this._requestModuleDependencies({
              system,
              name,
              version: versionToRequest,
            })
          : { nodes: [] };

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
                const dependencyId = getDependencyId(dependencyInfo);
                if (!this._parents[dependencyId]) {
                  this._parents[dependencyId] = [id];
                } else {
                  this._parents[dependencyId].push(id);
                }
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

        await Promise.all(
          dependencies.nodes.map((dependency) => {
            // @ts-expect-error The type is not correct in the proto. The real key is "version_key", while the type is "versionKey"
            const dependencyInfo = dependency.version_key;
            if (
              dependencyInfo.system !== system ||
              dependencyInfo.name !== name
            ) {
              return this._requestModuleAndDependenciesInfo(
                {
                  system: dependencyInfo.system,
                  name: dependencyInfo.name,
                  version: dependencyInfo.version,
                },
                {
                  isDirect: false,
                  ancestor: ancestorToPass,
                },
              );
            }
            return Promise.resolve();
          }),
        );
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
    };

    await Promise.all([getModuleInfo(), getDependenciesInfo()]);
    this._logger.silly(
      `Finished requesting module and dependencies info of ${id}`,
      {
        queue: this._queue.size,
      },
    );
  }

  /**
   * Request the information of the dependencies of the project to the deps.dev API
   * The result is stored in the instance
   * @param projectDependencies The dependencies found in the project files
   */
  private async _requestDependenciesInfo(
    projectDependencies: DependencyDeclaration[],
  ) {
    this._logger.info("Getting dependencies info from deps.dev API");
    return Promise.all([
      ...projectDependencies.map((dependency) => {
        return this._requestModuleAndDependenciesInfo(dependency, {
          isDirect: true,
          development: dependency.development,
          production: dependency.production,
        });
      }),
    ]);
  }

  /**
   * Returns the ancestors of a dependency (project dependencies being the root)
   * @param dependency The dependency to get the ancestors
   * @returns Array of ancestors of the dependency
   */
  private _getAncestors(dependency: DependencyId) {
    const searchAncestors = (
      dependencyId: DependencyId,
      deep = 0,
    ): string[] => {
      if (deep > 2) {
        this._logger.silly(
          `Too deep dependency tree for ${dependency}. Will use only the ancestor that triggered the request in order to avoid performance issues`,
        );
        const ancestor = this._depsDevModulesInfo[dependency].requestAncestor;
        if (!ancestor) {
          return [];
        }
        return [ancestor];
      }
      const ancestors = this._parents[dependencyId].filter((parent) => {
        return this._directDependencies.includes(parent);
      });
      if (!ancestors.length) {
        return this._parents[dependencyId]
          .map((parent) => {
            return searchAncestors(parent, deep + 1);
          })
          .flat();
      }
      return ancestors;
    };
    const result = searchAncestors(dependency);
    return Array.from(new Set(result));
  }

  /**
   * Iterate over the dependencies info and fill the information of the dependencies
   * It stores the information in the instance
   * In detail, it adds the direct, production, development, ancestors, origins, errors and warnings information
   * @param projectDependencies The dependencies found in the project files
   */
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

  /**
   * Get the errors from all dependencies info, adding the display name of the dependency to the error message and also errors from the project dependencies reader
   * @returns Array of errors with the display name of the dependency in the message, or the system in which from which reading the dependencies produced it
   */
  private _getErrors() {
    const dependenciesErrors = this._dependenciesInfo.flatMap(
      (dependencyInfo) => {
        const displayName = getDependencyDisplayName({
          id: dependencyInfo.id,
          version: dependencyInfo.version,
          resolvedVersion: dependencyInfo.resolvedVersion,
        });
        return dependencyInfo.errors.map((error) => {
          return {
            ...error,
            message: `${displayName}: ${error.message}`,
          };
        });
      },
    );
    this._errors = [
      ...dependenciesErrors,
      ...this._projectDependenciesReader.errors,
    ];
  }

  /**
   * Get the warnings from all dependencies info, adding the display name of the dependency to the warning message
   * @returns Array of warnings with the display name of the dependency in the message
   */
  private _getWarnings() {
    const dependenciesWarnings = this._dependenciesInfo.flatMap(
      (dependencyInfo) => {
        const displayName = getDependencyDisplayName({
          id: dependencyInfo.id,
          version: dependencyInfo.version,
          resolvedVersion: dependencyInfo.resolvedVersion,
        });
        return dependencyInfo.warnings.map(
          (warning) => `${displayName}: ${warning}`,
        );
      },
    );
    this._warnings = [
      ...dependenciesWarnings,
      ...this._projectDependenciesReader.warnings,
    ];
  }

  /**
   * Get the dependencies information from the project dependencies and the deps.dev API
   * It clears the cache, reads the project dependencies, requests the dependencies info and fills the dependencies info
   * @returns The dependencies information
   */
  private async _getDependencies(): Promise<GetDependenciesInfoResult> {
    this._clearCache();

    const projectDependencies = await this._readProjectDependencies();
    // NOTE: Defensively check if the dependencies are not undefined just in case the queue is cancelled.
    if (projectDependencies) {
      await this._requestDependenciesInfo(projectDependencies);
    }
    if (projectDependencies) {
      this._logger.info(
        `Retrieved information about ${Object.keys(this._depsDevModulesInfo).length} dependencies`,
      );
      this._fillDependenciesInfo(projectDependencies);
    }
    this._getErrors();
    this._getWarnings();
    this._logger.debug("Dependencies info", {
      dependencies: this._dependenciesInfo,
    });
    return this._dependenciesInfo;
  }

  /**
   * Look for the dependency files, read them and return the dependencies information using the deps.dev API
   * If any other execution is in progress, it waits for it to finish. Then, it clears the cache and starts the new execution
   */
  public async getDependencies(): Promise<GetDependenciesInfoResult> {
    if (this._getDependenciesPromise) {
      await this._getDependenciesPromise;
    }
    this._getDependenciesPromise = this._getDependencies();
    return this._getDependenciesPromise;
  }

  /**
   * Return the errors found while getting the dependencies information
   */
  public get errors() {
    return this._errors;
  }

  /**
   * Return the warnings found while getting the dependencies information
   */
  public get warnings() {
    return this._warnings;
  }
}
