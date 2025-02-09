// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "node:path";

import * as core from "@actions/core";
import { parse } from "yaml";
import { fromError } from "zod-validation-error";

import type { InputOptions, AllConfig } from "./Config.types";
import { allConfigSchema } from "./Config.types.js";

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
  const failOnNotValid = core.getInput("fail-on-not-valid");
  const reporter = core.getInput("reporter");
  const config = core.getMultilineInput("config").join("\n");
  const configFile = core.getInput("config-file");

  const inputs = {
    log: valueIfDefined(log),
    failOnNotValid: valueIfBoolean(failOnNotValid),
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
export async function getConfig(cwd: string): Promise<AllConfig> {
  const inputs = getInputs();
  let config: Partial<AllConfig> = {};
  let configFromFile: Partial<AllConfig> = {};

  if (inputs.config) {
    core.debug("Parsing the config option from the inputs");
    config = parseYamlConfig(inputs.config);
    core.debug(`Parsed config option from inputs: ${JSON.stringify(config)}`);
  }

  configFromFile = await loadConfigFile(
    path.resolve(
      cwd,
      inputs.configFile || "check-license-compliance.config.yml",
    ),
  );

  const inputsValues: InputOptions = {};

  if (inputs.log) {
    inputsValues.log = inputs.log as InputOptions["log"];
  }

  if (inputs.failOnNotValid !== undefined) {
    inputsValues.failOnNotValid = inputs.failOnNotValid;
  }

  if (inputs.reporter) {
    inputsValues.reporter = inputs.reporter as InputOptions["reporter"];
  }

  const mergedConfig = {
    ...configFromFile,
    ...config,
    ...inputsValues,
  };

  core.debug(
    `Configuration without default values: ${JSON.stringify(mergedConfig)}`,
  );

  const mergedConfigWithDefaults = {
    ...mergedConfig,
    log: mergedConfig.log || "info",
    failOnNotValid:
      mergedConfig.failOnNotValid === undefined
        ? true
        : mergedConfig.failOnNotValid,
    reporter: mergedConfig.reporter || "text",
  };

  core.debug(`Configuration: ${JSON.stringify(mergedConfigWithDefaults)}`);

  const result = allConfigSchema.safeParse(mergedConfigWithDefaults);

  if (!result.success) {
    core.error("Error validating the configuration");
    throw new Error(fromError(result.error).toString());
  }

  return result.data;
}
