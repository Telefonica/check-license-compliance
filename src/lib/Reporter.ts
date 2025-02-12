// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import indentString from "indent-string";
import stripIndent from "strip-indent";

import type { LicensesResult, Result } from "./Checker.types";
import { getDependencyDisplayName } from "./dependencies-reader/Helpers.js";
import type { Reporter } from "./Reporter.types";

const TITLE = "Check License Compliance";
export const ALL_VALID = "All dependencies have acceptable licenses.";
const CAVEATS_TITLE =
  "There were some issues while verifying the licenses. This can occasionally occur if a dependency was recently released, as the dependency graph may not yet be fully updated.";
const BOLD = "__";
const NOT_VALID_RESULT = "Result: Not valid licenses";
const VALID_RESULT = "Result: Valid licenses";

function bold(text: string, markdown: boolean): string {
  if (markdown) {
    return `${BOLD}${text}${BOLD}`;
  }
  return text;
}

function cursive(text: string, markdown: boolean): string {
  if (markdown) {
    return `_${text}_`;
  }
  return text;
}

function messageWithEmoji(
  emoji: string,
  message: string,
  markdown: boolean,
): string {
  return markdown ? `${emoji} ${message}` : message;
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
 * Replace new lines with spaces
 * @param text Text to remove new lines from
 * @returns The text without new lines
 */
function removeBlankLines(text: string): string {
  return text.replace(/\n/gm, " ");
}

function getAllowedMessage(
  allowed: LicensesResult[],
  markdown = true,
): string[] {
  const lines = [];
  if (allowed.length > 0) {
    lines.push("");
    const message =
      allowed.length === 1
        ? "There is one dependency with allowed licenses."
        : `There are ${allowed.length} dependencies with allowed licenses.`;
    lines.push(messageWithEmoji("✅", message, markdown));
    lines.push("");
  }
  return lines;
}

/**
 * Returns a markdown message with the dependencies that failed the check
 * @returns The markdown message
 */
function getForbiddenOrWarningMessage(
  modules: LicensesResult[],
  type: "dangerous" | "forbidden",
  emoji: string,
  markdown = true,
): string[] {
  const lines = [];
  const listSymbol = markdown ? "*" : "-";

  if (modules.length > 0) {
    lines.push("");
    if (modules.length > 1) {
      lines.push(
        messageWithEmoji(
          emoji,
          `There are ${modules.length} dependencies with ${type} licenses:`,
          markdown,
        ),
      );
    } else {
      lines.push(
        messageWithEmoji(
          emoji,
          `There is ${modules.length} dependency with ${type} licenses:`,
          markdown,
        ),
      );
    }
    for (const moduleInfo of modules) {
      const licensesToPrint = moduleInfo.licenses.join(", ");
      const originsToPrint = moduleInfo.origins.length
        ? `Defined in ${moduleInfo.origins.join(", ")}`
        : "Not able to determine the file where it is defined";
      const ancestorsToPrint = moduleInfo.ancestors.length
        ? moduleInfo.ancestors.join(", ")
        : "undetermined ancestors";
      const directMessage = moduleInfo.direct
        ? "Direct dependency"
        : `Transitive dependency of ${ancestorsToPrint}`;
      const displayName = getDependencyDisplayName({
        id: moduleInfo.module,
        version: moduleInfo.version,
        resolvedVersion: moduleInfo.resolvedVersion,
      });

      lines.push(
        indentString(
          `${listSymbol} ${bold(displayName, markdown)}: ${licensesToPrint}`,
          2,
        ),
      );
      const directAndOrigins = `${directMessage}. ${originsToPrint}`;
      lines.push(
        indentString(
          `${listSymbol} ${cursive(directAndOrigins, markdown)}`,
          markdown ? 6 : 4,
        ),
      );
    }
  }
  return lines;
}

/**
 * Returns a markdown message with the errors that happened while checking the licenses
 * @returns The markdown message
 */
function getCaveatsMessage(
  caveats: Result["caveats"],
  markdown = true,
): string[] {
  const lines = [];
  const listSymbol = markdown ? "*" : "-";

  if (caveats.errors.length > 0 || caveats.warnings.length > 0) {
    lines.push("");
    lines.push(messageWithEmoji("‼️", CAVEATS_TITLE, markdown));
    if (caveats.errors.length > 0) {
      lines.push("");
      lines.push("Errors:");
      lines.push("");
      for (const error of caveats.errors) {
        lines.push(
          indentString(`${listSymbol} ${bold(error.message, markdown)}`, 2),
        );
      }
    }
    if (caveats.warnings.length > 0) {
      lines.push("");
      lines.push("Warnings:");
      lines.push("");
      for (const warning of caveats.warnings) {
        lines.push(indentString(`${listSymbol} ${bold(warning, markdown)}`, 2));
      }
    }
  }
  return lines;
}

/**
 * Report a successful check
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
function successReport(reporter: Reporter, result: Result): string {
  const textMessage = `${getAllowedMessage(result.allowed, false).join("\n")}\n${getCaveatsMessage(result.caveats, false).join("\n")}`;

  switch (reporter) {
    case "json":
      return JSON.stringify({
        message: removeBlankLines(textMessage),
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__

        ${indentMarkdownBlock(getAllowedMessage(result.allowed), false) + indentMarkdownBlock(getCaveatsMessage(result.caveats))}
      `);
    default:
      return textMessage;
  }
}

/**
 * Report a failed check
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
function errorReport(
  reporter: Reporter,
  result: Result,
  isValid: boolean,
): string {
  const textTitle = isValid ? VALID_RESULT : NOT_VALID_RESULT;

  switch (reporter) {
    case "json":
      return JSON.stringify({
        message: `${textTitle}. Found ${result.allowed.length} allowed, ${result.forbidden.length} forbidden and ${result.warning.length} dangerous dependencies.`,
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__
        ${
          indentMarkdownBlock(getAllowedMessage(result.allowed), false) +
          indentMarkdownBlock(
            getForbiddenOrWarningMessage(result.warning, "dangerous", "⚠️"),
          ) +
          indentMarkdownBlock(
            getForbiddenOrWarningMessage(result.forbidden, "forbidden", "❌"),
          ) +
          indentMarkdownBlock(getCaveatsMessage(result.caveats))
        }

        ${!isValid ? messageWithEmoji("❌", NOT_VALID_RESULT, true) : messageWithEmoji("✅", VALID_RESULT, true)}
      `);
    default:
      return `${textTitle}\n${getAllowedMessage(result.allowed, false).join("\n")}${getForbiddenOrWarningMessage(result.warning, "dangerous", "", false).join("\n")}\n${getForbiddenOrWarningMessage(result.forbidden, "forbidden", "", false).join("\n")}\n${getCaveatsMessage(result.caveats, false).join("\n")}`;
  }
}

/**
 * Report a failed check
 * @param reporter The reporter to use
 * @param result The result of the check
 * @returns The report in the specified format
 */
function emptyReport(reporter: Reporter, result: Result): string {
  const message = "No dependencies found";
  switch (reporter) {
    case "json":
      return JSON.stringify({
        message,
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__

        ${indentMarkdownBlock([messageWithEmoji("✅", message, true)], false)}
      `);
    default:
      return message;
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
  if (
    result.forbidden.length === 0 &&
    result.warning.length === 0 &&
    result.allowed.length === 0
  ) {
    return emptyReport(reporter, result);
  }
  return result.forbidden.length > 0 || result.warning.length > 0
    ? errorReport(reporter, result, isValid)
    : successReport(reporter, result);
}
