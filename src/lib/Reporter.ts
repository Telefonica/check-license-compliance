// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import indentString from "indent-string";
import stripIndent from "strip-indent";

import type { LicensesResult, Result } from "./Checker.types";
import type { Reporter } from "./Reporter.types";

const TITLE = "Check License Compliance";
export const ALL_VALID = "All dependencies have acceptable licenses.";
const CAVEATS_TITLE =
  "There were some problems while checking the licenses. This may happen when the dependencies graph is not correctly detected because of some recent releases have not been detected by the devs.dep API yet.";
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

/**
 * Returns a markdown message with the dependencies that failed the check
 * @returns The markdown message
 */
function getErrorsMessage(
  errors: LicensesResult[],
  type: "dangerous" | "forbidden",
  emoji: string,
  markdown = true,
): string[] {
  const lines = [];
  const listSymbol = markdown ? "*" : "-";

  if (errors.length > 0) {
    lines.push("");
    if (errors.length > 1) {
      lines.push(
        messageWithEmoji(
          emoji,
          `There are ${errors.length} dependencies with ${type} licenses:`,
          markdown,
        ),
      );
    } else {
      lines.push(
        messageWithEmoji(
          emoji,
          `There is ${errors.length} dependency with ${type} licenses:`,
          markdown,
        ),
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

      lines.push(
        indentString(
          `${listSymbol} ${bold(error.module, markdown)}: ${licensesToPrint}`,
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
  const textMessage = `${ALL_VALID}\n${getCaveatsMessage(result.caveats, false).join("\n")}`;

  switch (reporter) {
    case "json":
      return JSON.stringify({
        message: removeBlankLines(textMessage),
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__

        ✅ ${ALL_VALID + indentMarkdownBlock(getCaveatsMessage(result.caveats))}
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
        message: textTitle,
        ...result,
      });
    case "markdown":
      return stripIndent(`
        __${TITLE}__
        ${
          indentMarkdownBlock(
            getErrorsMessage(result.forbidden, "forbidden", "❌"),
            false,
          ) +
          indentMarkdownBlock(
            getErrorsMessage(result.warning, "dangerous", "⚠️"),
          ) +
          indentMarkdownBlock(getCaveatsMessage(result.caveats))
        }

        ${!isValid ? messageWithEmoji("❌", NOT_VALID_RESULT, true) : messageWithEmoji("✅", VALID_RESULT, true)}
      `);
    default:
      return `${textTitle}\n${getErrorsMessage(result.forbidden, "forbidden", "", false).join("\n")}\n${getErrorsMessage(result.warning, "dangerous", "", false).join("\n")}\n${getCaveatsMessage(result.caveats, false).join("\n")}`;
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
