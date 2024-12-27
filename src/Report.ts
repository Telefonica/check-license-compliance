// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { LicenseCheckerResult, Result } from "./lib/Checker.types";
import { Reporter } from "./Config.types";
import stripIndent from "strip-indent";
import indentString from "indent-string";

const TITLE = "Check License Compliance";
export const ALL_VALID = "All dependencies have acceptable licenses.";

/**
 * Returns a markdown message with the dependencies that failed the check
 * @returns The markdown message
 */
function getErrorsMarkdown(
  errors: LicenseCheckerResult[],
  type: "dangerous" | "forbidden",
  emoji: string,
): string[] {
  const lines = [];
  if (errors.length > 0) {
    if (errors.length > 1) {
      lines.push(
        `${emoji} There are ${errors.length} dependencies with ${type} licenses:`,
      );
    } else {
      lines.push(
        `${emoji} There is ${errors.length} dependency with ${type} license:`,
      );
    }
    for (const error of errors) {
      const licensesToPrint = Array.isArray(error.licenses)
        ? error.licenses.join(", ")
        : error.licenses;
      lines.push(indentString(`* __${error.module}__: ${licensesToPrint}`, 2));
    }
  }
  return lines;
}

/**
 * Pluralize a word by adding an 's' at the end
 * @param count Number to check
 * @param singular Singular form of the word
 * @returns The word pluralized
 */
function pluralize(count: number, singular: string): string {
  const plurals = {
    dependency: "dependencies",
  };

  return count === 1 ? singular : plurals[singular as keyof typeof plurals];
}

/**
 * Replace new lines with spaces
 * @param text Text to remove new lines from
 * @returns The text without new lines
 */
function removeBlankLines(text: string): string {
  return text.replace(/\n/gm, " ");
}

/**
 * Report a successful check
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
export function successReport(reporter: Reporter, result: Result): string {
  const summary = ALL_VALID;
  switch (reporter) {
    case "json":
      return JSON.stringify({
        message: removeBlankLines(summary),
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__

        ✅ ${summary}
      `);
    default:
      return summary;
  }
}

/**
 * Report a failed check
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
export function errorReport(reporter: Reporter, result: Result): string {
  let summaryPhrases = [];

  summaryPhrases.push(
    `${result.forbidden.length} ${pluralize(result.forbidden.length, "dependency")} have forbidden licenses.`,
  );
  summaryPhrases.push(
    `${result.warning.length} ${pluralize(result.warning.length, "dependency")} have dangerous licenses.`,
  );

  const summary = summaryPhrases.join("\n");

  switch (reporter) {
    case "json":
      return JSON.stringify({
        message: removeBlankLines(summary),
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__

        ${getErrorsMarkdown(result.forbidden, "forbidden", "❌")
          .map((line, index) => (index > 0 ? indentString(line, 8) : line))
          .join("\n")}

        ${getErrorsMarkdown(result.warning, "dangerous", "⚠️")
          .map((line, index) => (index > 0 ? indentString(line, 8) : line))
          .join("\n")}
      `);
    default:
      return summary;
  }
}

/**
 * Get the report in the specified format
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
export function getReport(reporter: Reporter, result: Result): string {
  return result.forbidden.length > 0 || result.warning.length > 0
    ? errorReport(reporter, result)
    : successReport(reporter, result);
}
