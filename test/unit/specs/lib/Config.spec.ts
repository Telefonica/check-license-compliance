// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import { getSystemConfig } from "../../../../src/lib/Config";
import type { CheckerConfig } from "../../../../src/lib/Config.types";

describe("config", () => {
  it("should return system config correctly", () => {
    const config: CheckerConfig = {
      npm: { includeFiles: ["**/package.json"] },
      maven: { includeFiles: ["**/pom.xml"] },
      python: { includeFiles: ["**/requirements.txt"] },
      go: { includeFiles: ["**/go.mod"] },
    };
    const npmConfig = getSystemConfig("NPM", config);

    expect(npmConfig).toEqual({ includeFiles: ["**/package.json"] });
  });
});
