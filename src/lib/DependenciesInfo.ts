import path from "node:path";

import grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import PQueue from "p-queue";
import semver from "semver";

import { DirectDependenciesReader } from "./dependencies-reader/DependenciesReader.js";
import type {
  DependencyDeclaration,
  DependencyUniqueProps,
  DependencyId,
} from "./dependencies-reader/DependenciesReader.types";
import { getDependencyId } from "./dependencies-reader/Helpers.js";
import type {
  DependenciesInfoOptions,
  GetDependenciesInfoResult,
  DirectDependencies,
  DepsDevPackagesInfo,
  DepsDevDependenciesInfo,
  VersionOutput,
} from "./DependenciesInfo.types";
import { ROOT_PATH } from "./Paths.js";
import type { ProtoGrpcType } from "./proto/api";
import type { Dependencies__Output as DependenciesOutput } from "./proto/deps_dev/v3/Dependencies";
import type { GetVersionRequest } from "./proto/deps_dev/v3/GetVersionRequest";
import type { InsightsClient } from "./proto/deps_dev/v3/Insights";

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
  private _depsDevPackagesInfo: DepsDevPackagesInfo = {};
  private _depsDevDependenciesInfo: DepsDevDependenciesInfo = {};
  private _requestedPackages: DependencyId[] = [];
  private _directDependencies: DirectDependencies = [];
  private _directDevDependencies: DirectDependencies = [];
  private _directProdDependencies: DirectDependencies = [];
  private _dependenciesInfo: GetDependenciesInfoResult = [];
  private _projectDependenciesReader: DirectDependenciesReader;
  private _errors: Error[] = [];
  private _warnings: string[] = [];

  // TODO: Add options for the files to read
  constructor({ logger, cwd, npm }: DependenciesInfoOptions) {
    this._logger = logger;
    this._initGrpcClient();
    this._projectDependenciesReader = new DirectDependenciesReader({
      logger,
      cwd,
      npm,
    });
  }

  private _getRPCDeadline() {
    return new Date(Date.now() + 12000);
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
    this._depsDevPackagesInfo = {};
    this._depsDevDependenciesInfo = {};
    this._dependenciesInfo = [];
    this._directDependencies = [];
    this._directDevDependencies = [];
    this._directProdDependencies = [];
    this._requestedPackages = [];
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

  private async _requestPackageInfo({
    system,
    name,
    version,
  }: DependencyUniqueProps): Promise<VersionOutput> {
    const id = getDependencyId({
      system,
      name,
      version,
    });
    if (!semver.valid(version)) {
      const message = `Invalid version "${version}" while requesting info`;
      this._logger.error(`${message} of ${id}`);
      return Promise.reject(new Error(message));
    }
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        const message = `Timeout requesting package info`;
        this._logger.error(`${message} of ${id}`);
        reject(new Error(message));
      }, 10000);

      const requestData = {
        version_key: {
          system,
          name,
          version,
        },
        // NOTE: The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
      } as unknown as GetVersionRequest;

      this._depsDevInsightsClient.GetVersion(
        requestData,
        { deadline: this._getRPCDeadline() },
        (error, response) => {
          if (!timedOut) {
            clearTimeout(timeout);
            if (error || !response) {
              this._logger.error(`Error requesting info of ${id}`, error);
              reject(error);
              return;
            }
            this._logger.silly(`Response received for info of ${id}`, response);
            // NOTE: The type is not correct in the proto. The real key is "version_key", while the type is "versionKey". This is corrected in the VersionOutput type
            resolve(response as unknown as VersionOutput);
          }
        },
      );
    });
  }

  private async _requestPackageDependencies({
    system,
    name,
    version,
  }: DependencyUniqueProps): Promise<DependenciesOutput> {
    const id = getDependencyId({
      system,
      name,
      version,
    });
    if (!semver.valid(version)) {
      const message = `Invalid version "${version}" while requesting dependencies`;
      this._logger.error(`${message} of ${id}`);
      return Promise.reject(new Error(message));
    }
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        const message = `Timeout requesting package dependencies`;
        this._logger.error(`${message} of ${id}`);
        reject(new Error(message));
      }, 10000);

      const requestData = {
        version_key: {
          system,
          name,
          version,
        },
        // NOTE: The type is not correct in the proto. It expects a "versionKey" object, while the real key is "version_key"
      } as unknown as GetVersionRequest;

      this._depsDevInsightsClient.GetDependencies(
        requestData,
        { deadline: this._getRPCDeadline() },
        (error, response) => {
          if (!timedOut) {
            clearTimeout(timeout);
            if (error || !response) {
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
          }
        },
      );
    });
  }

  private _requestPackageAndDependenciesInfo({
    system,
    name,
    version,
  }: DependencyUniqueProps) {
    const id = getDependencyId({
      system,
      name,
      version,
    });

    if (
      this._requestedPackages.includes(
        getDependencyId({ system, name, version }),
      )
    ) {
      this._logger.silly(
        `The package ${id} has already been requested. Skipping`,
      );
      return;
    }

    this._requestedPackages.push(id);
    this._logger.debug(`Requesting package and dependencies info for ${id}`);

    this._queue.add(async () => {
      try {
        const packageInfo = await this._requestPackageInfo({
          system,
          name,
          version,
        });
        this._depsDevPackagesInfo[id] = packageInfo;
      } catch (error) {
        const err = error as Error;
        this._depsDevPackagesInfo[id] = {
          version_key: {
            system,
            name,
            version,
          },
          licenses: [],
          error: {
            ...err,
            message: `Error requesting package info: ${err.message}`,
          },
        };
      }
    });

    this._queue.add(async () => {
      try {
        const dependencies = await this._requestPackageDependencies({
          system,
          name,
          version,
        });

        this._depsDevDependenciesInfo[id] = {
          system,
          name,
          version,
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
                dependencyInfo.name !== name ||
                dependencyInfo.version !== version
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
          this._queue.add(async () => {
            await this._requestPackageAndDependenciesInfo({
              system: dependencyInfo.system,
              name: dependencyInfo.name,
              version: dependencyInfo.version,
            });
          });
        });
      } catch (error) {
        const err = error as Error;
        this._depsDevDependenciesInfo[id] = {
          system,
          name,
          version,
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
      this._requestPackageAndDependenciesInfo(dependency);
    });
  }

  private _getAncestors(dependency: DependencyId) {
    return Array.from(
      new Set(
        this._directDependencies.filter((directDependency) => {
          return this._depsDevDependenciesInfo[
            directDependency
          ].dependencies.some((dependencyInfo) => {
            return dependencyInfo.id === dependency;
          });
        }),
      ),
    );
  }

  private _fillDependenciesInfo(projectDependencies: DependencyDeclaration[]) {
    this._logger.info("Preparing dependencies info");

    Object.keys(this._depsDevPackagesInfo).forEach((id) => {
      const packageInfo = this._depsDevPackagesInfo[id];
      const dependenciesInfo = this._depsDevDependenciesInfo[id];
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
      if (packageInfo.error) {
        errors.push(packageInfo.error);
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
        system: packageInfo.version_key!.system,
        name: packageInfo.version_key!.name,
        version: packageInfo.version_key!.version,
        licenses: packageInfo.licenses,
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
    this._logger.debug("Dependencies info", this._dependenciesInfo);
    return this._dependenciesInfo;
  }

  public get errors() {
    return this._errors;
  }

  public get warnings() {
    return this._warnings;
  }
}
