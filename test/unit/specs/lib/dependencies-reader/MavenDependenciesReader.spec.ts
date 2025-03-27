// SPDX-FileCopyrightText: 2025 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

import fsExtra from "fs-extra";

import type {
  SystemDependenciesReaderOptions,
  MavenDependenciesReaderOptions,
} from "../../../../../src/lib/dependencies-reader/DependenciesReader.types";
import * as Helpers from "../../../../../src/lib/dependencies-reader/Helpers";
import { MavenDependenciesReader } from "../../../../../src/lib/dependencies-reader/MavenDependenciesReader";

// Mock fs-extra and path modules
jest.mock("fs-extra");
jest.mock<typeof import("node:path")>("node:path", () => ({
  ...jest.requireActual("node:path"),
  resolve: jest.fn(),
  relative: jest.fn(),
}));

// Mock logger
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
};

describe("mavenDependenciesReader", () => {
  let reader: MavenDependenciesReader;
  const mockOptions: SystemDependenciesReaderOptions<MavenDependenciesReaderOptions> =
    {
      // @ts-expect-error mock logger
      logger: mockLogger,
      development: true,
      production: true,
      cwd: "/mock/cwd",
    };

  beforeEach(() => {
    jest.resetAllMocks();

    // Setup default mock responses
    jest
    // eslint-disable-next-line jest/unbound-method
      .mocked(path.resolve)
      .mockImplementation((_cwd, filePath) => `/mock/cwd/${filePath}`);
    jest
    // eslint-disable-next-line jest/unbound-method
      .mocked(path.relative)
      .mockImplementation((_cwd, fullPath) =>
        fullPath.replace("/mock/cwd/", ""),
      );

    // Mock resolveVersion method
    jest.spyOn(Helpers, "resolveVersion").mockReturnValue("1.0.0");

    reader = new MavenDependenciesReader(mockOptions);
  });

  it("should be instantiated correctly", () => {
    expect(reader).toBeDefined();
    expect(reader.readDependencies).toBeDefined();
  });

  it("should parse dependencies from a simple pom.xml file", async () => {
    // Mock file content with simple dependencies
    const mockPomXml = `
    <project>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>1.2.3</version>
        </dependency>
        <dependency>
          <groupId>org.apache.commons</groupId>
          <artifactId>commons-lang3</artifactId>
          <version>3.12.0</version>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        system: "MAVEN",
        name: "org.example:example-lib",
        version: "1.2.3",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
    expect(deps[1]).toEqual(
      expect.objectContaining({
        system: "MAVEN",
        name: "org.apache.commons:commons-lang3",
        version: "3.12.0",
        resolvedVersion: "1.0.0", // Mocked resolved version
        development: false,
        production: true,
      }),
    );
  });

  it("should parse dependencies with different scopes", async () => {
    // Mock file content with dependencies having different scopes
    const mockPomXml = `
    <project>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>1.2.3</version>
          <scope>compile</scope>
        </dependency>
        <dependency>
          <groupId>org.junit.jupiter</groupId>
          <artifactId>junit-jupiter-api</artifactId>
          <version>5.8.2</version>
          <scope>test</scope>
        </dependency>
        <dependency>
          <groupId>jakarta.servlet</groupId>
          <artifactId>jakarta.servlet-api</artifactId>
          <version>5.0.0</version>
          <scope>provided</scope>
        </dependency>
        <dependency>
          <groupId>org.slf4j</groupId>
          <artifactId>slf4j-api</artifactId>
          <version>1.7.36</version>
          <scope>runtime</scope>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(4);

    // Compile scope should be marked as production and not development
    const compileScope = deps.find((d) => d.name === "org.example:example-lib");

    expect(compileScope).toEqual(
      expect.objectContaining({
        production: true,
        development: false,
      }),
    );

    // Test scope should be marked as development and not production
    const testScope = deps.find(
      (d) => d.name === "org.junit.jupiter:junit-jupiter-api",
    );

    expect(testScope).toEqual(
      expect.objectContaining({
        production: false,
        development: true,
      }),
    );

    // Provided scope should be marked as development and not production
    const providedScope = deps.find(
      (d) => d.name === "jakarta.servlet:jakarta.servlet-api",
    );

    expect(providedScope).toEqual(
      expect.objectContaining({
        production: false,
        development: true,
      }),
    );

    // Runtime scope should be marked as development and not production
    const runtimeScope = deps.find((d) => d.name === "org.slf4j:slf4j-api");

    expect(runtimeScope).toEqual(
      expect.objectContaining({
        production: false,
        development: true,
      }),
    );
  });

  it("should handle development flag overriding scope", async () => {
    const mockPomXml = `
    <project>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>1.2.3</version>
          <scope>compile</scope>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", true);

    expect(deps).toHaveLength(1);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "org.example:example-lib",
        production: false,
        development: true, // Even though scope is compile, isDevelopment=true overrides
      }),
    );
  });

  it("should handle property-based version resolution", async () => {
    const mockPomXml = `
    <project>
      <properties>
        <example.version>1.2.3</example.version>
        <commons.version>3.12.0</commons.version>
      </properties>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>\${example.version}</version>
        </dependency>
        <dependency>
          <groupId>org.apache.commons</groupId>
          <artifactId>commons-lang3</artifactId>
          <version>\${commons.version}</version>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "org.example:example-lib",
        version: "1.2.3", // Resolved from properties
      }),
    );
    expect(deps[1]).toEqual(
      expect.objectContaining({
        name: "org.apache.commons:commons-lang3",
        version: "3.12.0", // Resolved from properties
      }),
    );
  });

  it("should handle missing property definitions", async () => {
    const mockPomXml = `
    <project>
      <properties>
        <commons.version>3.12.0</commons.version>
      </properties>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>\${missing.version}</version>
        </dependency>
        <dependency>
          <groupId>org.apache.commons</groupId>
          <artifactId>commons-lang3</artifactId>
          <version>\${commons.version}</version>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(2);

    // For missing property, version should be undefined
    const missingPropDep = deps.find(
      (d) => d.name === "org.example:example-lib",
    );

    expect(missingPropDep?.version).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalled();

    // Property that exists should be resolved correctly
    const existingPropDep = deps.find(
      (d) => d.name === "org.apache.commons:commons-lang3",
    );

    expect(existingPropDep?.version).toBe("3.12.0");
  });

  it("should handle single dependency in pom.xml", async () => {
    const mockPomXml = `
    <project>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>1.2.3</version>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(1);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        system: "MAVEN",
        name: "org.example:example-lib",
        version: "1.2.3",
      }),
    );
  });

  it("should handle numeric version values", async () => {
    const mockPomXml = `
    <project>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>1</version>
        </dependency>
      </dependencies>
    </project>
    `;

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(1);
    expect(deps[0]).toEqual(
      expect.objectContaining({
        name: "org.example:example-lib",
        version: "1",
      }),
    );
  });

  it("should handle errors when resolving versions", async () => {
    const mockPomXml = `
    <project>
      <dependencies>
        <dependency>
          <groupId>org.example</groupId>
          <artifactId>example-lib</artifactId>
          <version>1.2.3</version>
        </dependency>
      </dependencies>
    </project>
    `;

    // Mock the resolveVersion method to throw an error
    jest.spyOn(Helpers, "resolveVersion").mockImplementation(() => {
      throw new Error("Version resolution error");
    });

    //@ts-expect-error mock
    jest.mocked(fsExtra.readFile).mockResolvedValue(mockPomXml);

    const deps = await reader.readFileDependencies("pom.xml", false);

    expect(deps).toHaveLength(1);
    // Should use the original version when resolution fails
    expect(deps[0].version).toBe("1.2.3");
    expect(deps[0].resolvedVersion).toBe("1.2.3");
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
