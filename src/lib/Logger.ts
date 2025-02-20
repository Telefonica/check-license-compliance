// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import chalk from "chalk";
import winston from "winston";
const { combine, colorize, timestamp, printf } = winston.format;

import type { LogLevel } from "./Logger.types";

/**
 * Print extra information to the log. Any object passed as a second argument to the winston logger will be printed as a gray json string due to this function.
 * @param info The log information
 * @returns A json string with the extra information.
 */
function printExtraInfo(info: winston.Logform.TransformableInfo) {
  const objectToPrint: Record<string, unknown> = {};

  for (const key in info) {
    if (key !== "message" && key !== "level" && key !== "timestamp") {
      objectToPrint[key] = info[key];
    }
  }
  if (Object.keys(objectToPrint).length === 0) {
    return "";
  }

  return `: ${chalk.gray(JSON.stringify(objectToPrint))}`;
}

/**
 * Returns a winston logger
 * @param level The log level
 * @returns Winston logger
 */
export function createLogger(level?: LogLevel) {
  const logger = winston.createLogger({
    level: level || "info",
    format: combine(
      colorize(),
      timestamp(),
      printf(
        (info) =>
          `${info.timestamp} ${info.level}: ${info.message}${printExtraInfo(info)}`,
      ),
    ),
    transports: [new winston.transports.Console()],
  });
  return logger;
}
