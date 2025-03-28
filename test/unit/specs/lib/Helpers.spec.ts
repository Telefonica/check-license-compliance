// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import * as Config from "../../../../src/lib/Config";
import type {
  ModuleSpec,
  OptionsBySystem,
} from "../../../../src/lib/dependencies-reader/DependenciesReader.types";
import type { DependencyBasicInfo } from "../../../../src/lib/DependenciesInfo.types";
import {
  moduleMatchSpecs,
  dependencyIsExcluded,
  dependencyIsIncluded,
  dependencyIsIgnored,
} from "../../../../src/lib/Helpers";

// Mock the getSystemConfig function
jest.mock<typeof import("../../../../src/lib/Config.js")>(
  "../../../../src/lib/Config.js",
  () => ({
    getSystemConfig: jest.fn(),
  }),
);

describe("helpers", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("moduleMatchSpecs", () => {
    it("should return true when a string module spec matches the dependency id", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const moduleSpecs: ModuleSpec[] = ["NPM:test-module@1.0.0"];

      // Act
      const result = moduleMatchSpecs(dependency, moduleSpecs);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true when a string module spec without system id matches the dependency name", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const moduleSpecs: ModuleSpec[] = ["test-module@1.0.0"];

      // Act
      const result = moduleMatchSpecs(dependency, moduleSpecs);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true when an object module spec matches the dependency", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const moduleSpecs: ModuleSpec[] = [
        { name: "test-module", version: "1.0.0" },
      ];

      // Act
      const result = moduleMatchSpecs(dependency, moduleSpecs);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when no module specs match the dependency", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const moduleSpecs: ModuleSpec[] = [
        "NPM:other-module@1.0.0",
        "NPM:another-module@2.0.0",
      ];

      // Act
      const result = moduleMatchSpecs(dependency, moduleSpecs);

      // Assert
      expect(result).toBe(false);
    });

    it("should return true when requireIgnored is true and the module spec has ignore set to true", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const moduleSpecs: ModuleSpec[] = [
        { name: "test-module", version: "1.0.0", ignore: true },
      ];

      // Act
      const result = moduleMatchSpecs(dependency, moduleSpecs, true);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when requireIgnored is true and the module spec has ignore set to false", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const moduleSpecs: ModuleSpec[] = [
        { name: "test-module", version: "1.0.0", ignore: false },
      ];

      // Act
      const result = moduleMatchSpecs(dependency, moduleSpecs, true);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("dependencyIsExcluded", () => {
    it("should return true when dependency is in the excludeModules list", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:excluded-module@1.0.0",
        system: "NPM",
        name: "excluded-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          excludeModules: ["excluded-module"],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        excludeModules: ["excluded-module"],
      });

      // Act
      const result = dependencyIsExcluded(dependency, config);

      // Assert
      expect(result).toBe(true);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });

    it("should return false when dependency is not in the excludeModules list", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:included-module@1.0.0",
        system: "NPM",
        name: "included-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          excludeModules: ["excluded-module"],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        excludeModules: ["excluded-module"],
      });

      // Act
      const result = dependencyIsExcluded(dependency, config);

      // Assert
      expect(result).toBe(false);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });

    it("should return false when excludeModules is not defined", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {},
      };

      // Mock the getSystemConfig to return the npm config without excludeModules
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({});

      // Act
      const result = dependencyIsExcluded(dependency, config);

      // Assert
      expect(result).toBe(false);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });
  });

  describe("dependencyIsIncluded", () => {
    it("should return true when dependency is in the modules list", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:included-module@1.0.0",
        system: "NPM",
        name: "included-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          modules: ["included-module"],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        modules: ["included-module"],
      });

      // Act
      const result = dependencyIsIncluded(dependency, config);

      // Assert
      expect(result).toBe(true);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });

    it("should return false when dependency is not in the modules list", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:other-module@1.0.0",
        system: "NPM",
        name: "other-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          modules: ["included-module"],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        modules: ["included-module"],
      });

      // Act
      const result = dependencyIsIncluded(dependency, config);

      // Assert
      expect(result).toBe(false);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });

    it("should return true when modules is not defined", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:test-module@1.0.0",
        system: "NPM",
        name: "test-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {},
      };

      // Mock the getSystemConfig to return the npm config without modules
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({});

      // Act
      const result = dependencyIsIncluded(dependency, config);

      // Assert
      expect(result).toBe(true);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });
  });

  describe("dependencyIsIgnored", () => {
    it("should return true when dependency is in the excludeModules list and has ignore set to true", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:ignored-module@1.0.0",
        system: "NPM",
        name: "ignored-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          excludeModules: [{ name: "ignored-module", ignore: true }],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        excludeModules: [{ name: "ignored-module", ignore: true }],
      });

      // Act
      const result = dependencyIsIgnored(dependency, config);

      // Assert
      expect(result).toBe(true);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });

    it("should return false when dependency is in the excludeModules list but does not have ignore set to true", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:excluded-module@1.0.0",
        system: "NPM",
        name: "excluded-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          excludeModules: [{ name: "excluded-module" }],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        excludeModules: [{ name: "excluded-module" }],
      });

      // Act
      const result = dependencyIsIgnored(dependency, config);

      // Assert
      expect(result).toBe(false);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });

    it("should return false when dependency is not in the excludeModules list", () => {
      // Arrange
      const dependency: DependencyBasicInfo = {
        id: "NPM:normal-module@1.0.0",
        system: "NPM",
        name: "normal-module",
        version: "1.0.0",
      };
      const config: OptionsBySystem = {
        npm: {
          excludeModules: [{ name: "ignored-module", ignore: true }],
        },
      };

      // Mock the getSystemConfig to return the npm config
      jest.spyOn(Config, "getSystemConfig").mockReturnValue({
        excludeModules: [{ name: "ignored-module", ignore: true }],
      });

      // Act
      const result = dependencyIsIgnored(dependency, config);

      // Assert
      expect(result).toBe(false);
      expect(Config.getSystemConfig).toHaveBeenCalledWith("NPM", config);
    });
  });
});
