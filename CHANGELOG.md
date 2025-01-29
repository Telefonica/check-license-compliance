# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

#### Added
#### Changed
#### Fixed
#### Deprecated
#### Removed

## [2.0.0] - 2025-02-03

### Added

* feat: Add `licenses.others` option
* feat: Add `licenses.unknown` option
* feat: Add `production` option
* feat: Add `development` option
* feat: Add `direct` option
* feat: Add `packages` option
* feat: Add `excludePackages` option
* feat: Add `excludePrivatePackages` option

### Removed

* feat(BREAKING CHANGE): Remove `allowWarnings` option. It has no sense anymore with the new options.
* feat(BREAKING CHANGE): Remove `licenseCheckerOptions` option. It has no sense anymore with the new options.

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
