# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

#### Added
#### Changed
#### Fixed
#### Deprecated
#### Removed

## [Unreleased]

### Added

* test: Add unit tests for all the features

### Changed

* feat: Change "one dependency" by "1 dependency" in the success report message, to make it more consistent with the other messages

## [3.0.0-beta.3] - 2025-03-21

### Added

* feat: Support including or excluding dependencies from the check by:
  - Name equality
  - Name regex
  - Version equality
  - Version regex
  - Version semver range

### Changed

* docs: Improve contributing docs
* chore: Add copilot instructions

## [3.0.0-beta.2] - 2025-02-13

### Fixed

* chore: Change copyright headers. Remove "and contributors" from files in which no external developers have contributed.

## [3.0.0-beta.1] - 2025-02-13

### Added

* feat: Support Python, Maven, and Go projects
* feat: Support monorepos. Any projects with multiple `package.json`, `requirements.txt`, `requirements.dev.txt`, `go.mod`, or `pom.xml` files will be analyzed
* feat: Support customizing files to be analyzed by language
* feat: Use the deps.dev API to get the licenses information. So, dependencies installation is not needed anymore
* feat: Add `npm`, `maven`, `python` and `go` options to set specific configuration for each language
* feat: Add `path` input to the action, enabling the user to set the path to the project root

### Changed

* feat(BREAKING CHANGE): Rename `direct` option to `onlyDirect`
* feat(BREAKING CHANGE): Invert the logic of the `production` option. Now it should be set to false to exclude production dependencies
* feat(BREAKING CHANGE): Invert the logic of the `development` option. Now it should be set to false to exclude development dependencies
* feat(BREAKING CHANGE): Report unknown licenses as warnings by default
* chore: Use a Docker container to run the action in order to avoid issues when bundling the grpc dependencies
* chore: Use Pnpm as package manager

### Removed

* feat(BREAKING CHANGE): Remove `packages` option. Now it is replaced by the `modules` option inside each language configuration.
* feat(BREAKING CHANGE): Remove `excludePackages` option. Now it is replaced by the `excludeModules` option inside each language configuration.
* feat(BREAKING CHANGE): Remove `allowWarnings` option. It has no sense anymore with the new options.
* feat(BREAKING CHANGE): Remove `licenseCheckerOptions` option. It has no sense anymore with the new implementation.
* chore: Remove fork of spdx-satisfies library, because the version that we wanted to use was already released

### Fixed

* fix: Remove defaults from the inputs, so all options can be set in the configuration file

## [2.0.0] - 2025-02-04

### Added

* feat: Add `licenses.others` option
* feat: Add `licenses.unknown` option
* feat: Add `production` option
* feat: Add `development` option
* feat: Add `direct` option
* feat: Add `packages` option
* feat: Add `excludePackages` option
* feat: Add `excludePrivatePackages` option

### Changed

* feat: Report unknown licenses as warnings by default
* refactor: Run license-checker only once to get the dependencies ignoring the allowed ones. Use `spdx-satisfies` to check the type of each package license according to the configuration. 

## [1.0.0] - 2025-01-17

#### Added

* test: Add unit tests
* test: Add E2E tests

### Changed

* docs: Change github inputs examples to JSON format to avoid indentation issues

### Fixed

* fix: Fix plurals in report messages

## [0.3.0] - 2025-01

### Added

* feat: Do not fail action if no node_modules folder is found. Return a warning instead.

### Changed

* chore: Pin @types/license-checker to 25.0.6

## [0.2.0] - 2025-01

### Added

* feat: Support running composite action both in PRs or pushes. In pushes, the action won't send any comment.

### Fixed

* docs: Fix complex configuration example in README.

## [0.1.0] - 2024-12

### Added

* feat: First beta version
