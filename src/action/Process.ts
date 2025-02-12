// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

function shutdown(signal: string, exitCode: number) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Cleaning up...`);
  process.exit(exitCode);
}

export function setupProcess() {
  process.on("SIGINT", () => shutdown("SIGINT", 130));
  process.on("SIGTERM", () => shutdown("SIGTERM", 143));

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1);
  });
}
