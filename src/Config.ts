// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as core from "@actions/core";
import { parse } from "yaml";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { inputOptionsSchema } from "./Config.types";
import type { InputOptions } from "./Config.types";
import { fromError } from "zod-validation-error";

/**
 * Returns the value if it is defined, otherwise returns undefined.
 * @param value The value to check.
 * @returns The value if it is defined, otherwise undefined.
 */
function valueIfDefined<T = string>(value: T): T | undefined {
  return value === "" ? undefined : value;
}

/**
 * Returns the boolean value if it is defined, otherwise returns undefined.
 * @param value The value to check.
 * @returns The boolean value if it is defined, otherwise undefined.
 */
function valueIfBoolean(value: string): boolean | undefined {
  if (value === "") {
    return undefined;
  }
  /*
   * NOTE: Using core.getInputBoolean() would be better, but it seems to not be working properly.
   * I assigned a default value of true in the action.yml file, but it does not work as expected, at least in the action debugger.
   * To be verified.
   */
  if (!["true", "True", "TRUE", "false", "False", "FALSE"].includes(value)) {
    throw new Error("Invalid boolean value");
  }
  return ["true", "True", "TRUE"].includes(value);
}

/**
 * Returns the inputs from the action.
 * @returns The inputs from the action.
 */
function getInputs() {
  const log = core.getInput("log");
  const failOnForbidden = core.getInput("fail-on-forbidden");
  const failOnWarning = core.getInput("fail-on-warning");
  const reporter = core.getInput("reporter");
  const config = core.getMultilineInput("config").join("\n");
  const configFile = core.getInput("config-file");

  const inputs = {
    log: valueIfDefined(log),
    failOnForbidden: valueIfBoolean(failOnForbidden),
    failOnWarning: valueIfBoolean(failOnWarning),
    reporter: valueIfDefined(reporter),
    config: valueIfDefined(config),
    configFile: valueIfDefined(configFile),
  };

  (Object.keys(inputs) as (keyof typeof inputs)[]).forEach((key) => {
    if (inputs[key] === undefined) {
      delete inputs[key];
    }
  });

  core.debug(`Inputs: ${JSON.stringify(inputs)}`);

  return inputs;
}

/**
 * Parses a YAML configuration
 * @param config The configuration to parse
 * @returns The parsed configuration
 */
function parseYamlConfig(config: string) {
  return parse(config);
}

async function loadConfigFile(configFile: string) {
  const fileExists = existsSync(configFile);
  if (fileExists) {
    core.info(`Configuration file ${configFile} found. Loading...`);
    const config = await readFile(configFile, "utf8");
    const parsedConfig = parseYamlConfig(config);

    core.debug(`Configuration from file: ${JSON.stringify(parsedConfig)}`);
    return parsedConfig;
  }
  core.info(`Configuration file ${configFile} not found`);
  return {};
}

/**
 * Returns the configuration from the action inputs, loading configuration files if needed and parsing the inputs accordingly.
 * @returns The configuration from the action inputs and configuration files.
 */
export async function getConfig(): Promise<InputOptions> {
  const inputs = getInputs();
  let config: Partial<InputOptions> = {};
  let configFromFile: Partial<InputOptions> = {};
  let parsedInputs: Partial<InputOptions> = {};

  if (inputs.config) {
    core.debug("Parsing the config option from the inputs");
    config = parseYamlConfig(inputs.config);
    core.debug(`Parsed config option from inputs: ${JSON.stringify(config)}`);
  }

  configFromFile = await loadConfigFile(
    inputs.configFile || "check-license-compliance.config.yml",
  );

  const mergedConfig = {
    ...configFromFile,
    ...config,
    ...inputs,
    ...parsedInputs,
  };

  core.debug(
    `Configuration without default values: ${JSON.stringify(mergedConfig)}`,
  );

  const mergedConfigWithDefaults = {
    ...mergedConfig,
    log: mergedConfig.log || "info",
    failOnWarning:
      mergedConfig.failOnWarning === undefined
        ? true
        : mergedConfig.failOnWarning,
    failOnForbidden:
      mergedConfig.failOnForbidden === undefined
        ? true
        : mergedConfig.failOnForbidden,
    reporter: mergedConfig.reporter || "text",
  };

  core.debug(`Configuration: ${JSON.stringify(mergedConfigWithDefaults)}`);

  const result = inputOptionsSchema.safeParse(mergedConfigWithDefaults);

  if (!result.success) {
    core.error("Error validating the configuration");
    throw new Error(fromError(result.error).toString());
  }

  return result.data;
}
