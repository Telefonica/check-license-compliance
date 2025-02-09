// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import stripIndent from "strip-indent";
import indentString from "indent-string";

import { LicensesResult, Result } from "./lib/Checker.types";
import { Reporter } from "./Config.types.js";

const TITLE = "Check License Compliance";
export const ALL_VALID = "All dependencies have acceptable licenses.";
const CAVEATS_TITLE =
  "There were some problems while checking the licenses. This may happen when the dependencies graph is not correctly detected because of some recent releases have not been detected by the devs.dep API yet.";

/**
 * Returns a markdown message with the dependencies that failed the check
 * @returns The markdown message
 */
function getErrorsMarkdown(
  errors: LicensesResult[],
  type: "dangerous" | "forbidden",
  emoji: string,
): string[] {
  const lines = [];
  if (errors.length > 0) {
    lines.push("");
    if (errors.length > 1) {
      lines.push(
        `${emoji} There are ${errors.length} dependencies with ${type} licenses:`,
      );
    } else {
      lines.push(
        `${emoji} There is ${errors.length} dependency with ${type} licenses:`,
      );
    }
    for (const error of errors) {
      const licensesToPrint = error.licenses.join(", ");
      const originsToPrint = error.origins.length
        ? `Defined in ${error.origins.join(", ")}`
        : "Not able to determine the file where it is defined";
      const ancestorsToPrint = error.ancestors.length
        ? error.ancestors.join(", ")
        : " undetermined ancestors";
      const directMessage = error.direct
        ? "Direct dependency"
        : `Transitive dependency of ${ancestorsToPrint}`;

      lines.push(indentString(`* __${error.module}__: ${licensesToPrint}`, 2));
      lines.push(indentString(`- _${directMessage}. ${originsToPrint}_`, 6));
    }
  }
  return lines;
}

/**
 * Returns a markdown message with the errors that happened while checking the licenses
 * @returns The markdown message
 */
function getCaveatsMarkdown(caveats: Result["caveats"]): string[] {
  const lines = [];
  if (caveats.errors.length > 0 || caveats.warnings.length > 0) {
    lines.push("");
    lines.push(`‼️ ${CAVEATS_TITLE}`);
    if (caveats.errors.length > 0) {
      lines.push("");
      lines.push("Errors:");
      lines.push("");
      for (const error of caveats.errors) {
        lines.push(indentString(`* __${error.message}__`, 2));
      }
    }
    if (caveats.warnings.length > 0) {
      lines.push("");
      lines.push("Warnings:");
      lines.push("");
      for (const warning of caveats.warnings) {
        lines.push(indentString(`* __${warning}__`, 2));
      }
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
    has: "have",
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

        ✅ ${summary + indentMarkdownBlock(getCaveatsMarkdown(result.caveats))}
      `);
    default:
      return summary;
  }
}

function indentMarkdownBlock(lines: string[], indentFirst = true): string {
  // NOTE: Add an empty line to separate the block from the previous one in case it is not the first one
  const linesToIndent = indentFirst ? ["", ...lines] : lines;
  return linesToIndent
    .map((line, index) =>
      index > 0 || indentFirst
        ? indentString(line, 8, { includeEmptyLines: true })
        : line,
    )
    .join("\n");
}

/**
 * Report a failed check
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
export function errorReport(
  reporter: Reporter,
  result: Result,
  isValid: boolean,
): string {
  let summaryPhrases = [];

  summaryPhrases.push(
    `${result.forbidden.length} ${pluralize(result.forbidden.length, "dependency")} ${pluralize(result.forbidden.length, "has")} forbidden licenses.`,
  );
  summaryPhrases.push(
    `${result.warning.length} ${pluralize(result.warning.length, "dependency")} ${pluralize(result.warning.length, "has")} dangerous licenses.`,
  );
  if (result.caveats.errors.length > 0 || result.caveats.warnings.length > 0) {
    summaryPhrases.push(CAVEATS_TITLE);
    if (result.caveats.errors.length > 0) {
      summaryPhrases.push(
        `Errors:`,
        ...result.caveats.errors.map(
          (error, index) => `${index + 1} - ${error.message}.`,
        ),
      );
    }
    if (result.caveats.errors.length > 0) {
      summaryPhrases.push(
        `Warnings:`,
        ...result.caveats.warnings.map(
          (warning, index) => `${index + 1} - ${warning}.`,
        ),
      );
    }
  }

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
        ${
          indentMarkdownBlock(
            getErrorsMarkdown(result.forbidden, "forbidden", "❌"),
            false,
          ) +
          indentMarkdownBlock(
            getErrorsMarkdown(result.warning, "dangerous", "⚠️"),
          ) +
          indentMarkdownBlock(getCaveatsMarkdown(result.caveats))
        }

        ${!isValid ? "❌ Result: Not valid licenses" : "✅ Result: Valid licenses"}
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
export function getReport(
  reporter: Reporter,
  result: Result,
  isValid: boolean,
): string {
  return result.forbidden.length > 0 || result.warning.length > 0
    ? errorReport(reporter, result, isValid)
    : successReport(reporter, result);
}