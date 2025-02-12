import type { CheckerConfig } from "./Config.types";
import type {
  System,
  SystemDependenciesOptions,
} from "./dependencies-reader/DependenciesReader.types";
import { SYSTEM_CONFIGS_MAP } from "./dependencies-reader/Helpers.js";

export function getSystemConfig(
  system: System,
  config: CheckerConfig,
): SystemDependenciesOptions {
  const systemOptions = config[SYSTEM_CONFIGS_MAP[system]];
  return systemOptions || {};
}
