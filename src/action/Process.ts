// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

/**
 * Shutdown the process gracefully.
 * @param signal The signal that triggered the shutdown
 * @param exitCode The exit code to use
 */
function shutdown(signal: string, exitCode: number) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Cleaning up...`);
  process.exit(exitCode);
}

/**
 * Setup the process to handle signals and uncaught exceptions.
 */
export function setupProcess() {
  process.on("SIGINT", () => shutdown("SIGINT", 130));
  process.on("SIGTERM", () => shutdown("SIGTERM", 143));

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1);
  });
}
