# How to contribute

Thank you for being part of the Telefónica Open Source Community!

## Table of Contents

- [Getting started](#getting-started)
- [Test the action locally](#test-the-action-locally)
- [Branching model](#branching-model)
- [Pull Request](#pull-request)
- [Versioning](#versioning)
- [Release process](#release-process)
- [License](#license)
  - [Licensing of new files](#licensing-of-new-files)
  - [Public Domain](#public-domain)
- [Pull Request](#pull-request)
- [Code of Conduct](#code-of-conduct)
- [Contributor License Agreement](#contributor-license-agreement)

## Getting started

1. :hammer_and_wrench: Install the dependencies

   ```bash
   pnpm install
   ```

2. :white_check_mark: Run the unit tests

   ```bash
   $ pnpm test:unit

   PASS  test/unit/specs/main.spec.ts
   PASS  test/unit/specs/index.spec.ts
   ...

## Test the action locally

The action is a Docker container that runs a Node.js script. To test the action locally, you can run the Docker compose file in the root of the repository. This will build the Docker image and run the action in a container.

```bash
$ docker compose build
$ docker compose run action
```

You can provide a `.env` file to set environment variables used by the GitHub Actions Toolkit. For more information, see the example file, [`.env.example`](./.env.example), and the
[GitHub Actions Documentation](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).

> [!IMPORTANT]
> The action will search for configuration file and dependencies in the `/github/workspace` directory. The root workspace directory is mounted as a volume in the container in that folder, so it will check for the configuration file and dependencies in the root of the repository, checking its own dependencies. You can set another directory to be checked by setting the `INPUT_PATH` environment variable to the desired directory (e.g. `INPUT_PATH=test-config`).

## Test the Node.js code locally

Apart from running the unit tests, you can also run the Node.js code locally by following these steps:

* Modify the `src/action/index.ts` file to change the running directory from `/github/workspace` to the desired directory.
* Build the action code using the `pnpm build` command.
* Run the action code using the `node bin/check-license-compliance-action.js` command.

## Updating the Grpc Proto files

The code uses Protobuf files to define the gRPC services. The Protobuf files are located in the `proto` directory, and they are copied from the original repository. To update the Protobuf files, you should:

1. Checkout the Git submodules:
   ```bash
   $ git submodule update --init --recursive
   ```
2. Update the Protobuf files:
   ```bash
   $ git submodule update --remote
   ```
3. Copy the Protobuf files to the `proto` directory, by running the following script:
   ```bash
   $ ./script/copy-protos.sh
   ```
4. Update the generated TypeScript files from proto definitions:
   ```bash
   pnpm run proto:gen-types
   ```

## Branching model

In short, we have a "main" branch and a "release" branch. The "main" branch must always reflect the latest stable published version of the packages in the repository. The "release" branch is used to prepare the release of features without having to promote any unpublished changes to the "main" branch. It is the default branch for PRs.

Some important points to consider:

* __The "main" branch must always reflect the latest stable published version of the packages in the repository__.
* We have a "release" branch for the following reasons:
   * To enable the maintainer to prepare the release of features without having to promote any unpublished changes to the "main" branch. By preparing the release we mainly mean to decide how to group changes in different releases.
   * It is long-lived because we also have bots that will open PRs. So, they can be configured to open PRs to the "release" branch, and their changes will also enter in the process of preparing the release, such as changes from any other contributor.
* __The "release" branch is the default branch for PRs.__ Only a project maintainer should open a PR to the "main" branch, and only when the release is ready to be published.
* Usually, feature branches should be short-lived, and they should be merged into the "release" branch as soon as possible. This way, the changes will be included in the next release, and the feature branch can be deleted.
* When necessary, a medium-lived branch can be created from the "release" branch to group changes that will be released together and require more time to be prepared. Once the changes are ready, the branch can be merged into the "release" branch.

> [!IMPORTANT]
> The action code must be always packaged before pushing changes to the repository. This is because the action code is executed in the GitHub Actions environment, and it must be in the JavaScript format. The action code is packaged using the `npm run package` command. A github action check is executed on every PR to verify if the action code was packaged before pushing changes to the repository.

### Merging strategy

We use the __squash and merge strategy for merging PRs to the release branch__. This means that all the changes in the PR will be squashed into a single commit before being merged. The reasons are:

* To keep the history clean in the release branch
* To make easier to understand the changes in each release.

But we use the __merge commit strategy for merging PRs to the main branch from the release branch__. The reasons are:

* To keep in the history the information about the features that were merged separately into the release branch. This is very important, because we may have changes from different packages in the release branch. Squashing all the changes into a single commit would make it difficult to understand or revert the changes for a specific package.
* To avoid having to rebase the release branch every time a PR is merged to the main branch.

## Pull Request
When you're finished with the changes, create a pull request, also known as a PR.

* Fill the PR template. This template helps reviewers understand your changes as well as the purpose of your pull request.
* Don't forget to [link PR to issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue) if you are solving one.
* Enable the checkbox to [allow maintainer edits](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge. Once you submit your PR, a maintainer will review your proposal. We may ask questions or request additional information.
* We may ask for changes to be made before a PR can be merged, either using suggested changes or pull request comments. You can apply suggested changes directly through the UI. You can make any other changes in your fork, then commit them to your branch.
* As you update your PR and apply changes, mark each conversation as resolved.
* If you run into any merge issues, checkout this git tutorial to help you resolve merge conflicts and other issues.

## Versioning

This project uses [Semantic Versioning](https://semver.org/). The version number is defined in the `package.json` file. The version number must be updated in the `package.json` file before creating a new release.

> [!WARNING]
> The `check-and-comment` composite action version must be always updated before creating a new release. This is because the action itself can't be referenced locally when it is used in a external workflow. So, the reference to the action (`Telefonica/check-license-compliance@x`) must always point to the latest released version. For example:
> If the version in the package.json file is `1.0.0`, the reference to the action in the composite action must be `Telefonica/check-license-compliance@v1.0.0` before tagging the release. __Note that this would lead to an error when running the PR check, because the action is not published yet. But this is the expected behavior, so, the action should be changed to the PR branch when opening a PR, and changed to the released version before tagging the release.__

## Release process

> [!IMPORTANT]
> Before opening a PR, a new tag must be created in the repository with a beta version. This is because the composite action is used in the PR check, and the action must be referenced in the PR. The action can't be referenced locally, so it must be referenced by a tag. The tag must be created in the format `vX.Y.Z-beta.N`, where `X.Y.Z` is the version in the package.json file, and `N` is the beta version. For example, if the version in the package.json file is `1.0.0`, the tag must be `v1.0.0-beta.1`. This beta version must be defined in the `check-and-comment` composite action in the PR branch and in the package.json file. The beta version must be removed before tagging the release, as described below.

Once the PR is approved and __merged into the release branch__, a project maintainer can start the release process by:

1. Checking the version number in the `package.json` file and updating it if necessary.
2. Checking the action version in the `.github/actions/check-and-comment/action.yml` file and updating it if necessary.
3. Updating the CHANGELOG.md file with the changes in the new version.
4. Remove the beta tags created for the PR check.
5. Tagging the release branch with the corresponding version numbers.

   This project includes a helper script, [`script/release`](./script/release)
   designed to streamline the process of tagging and pushing new releases for
   GitHub Actions.

   GitHub Actions allows users to select a specific version of the action to use,
   based on release tags. This script simplifies this process by performing the
   following steps:

   1. **Retrieving the latest release tag:** The script starts by fetching the most
      recent SemVer release tag of the current branch, by looking at the local data
      available in your repository.
   1. **Prompting for a new release tag:** The user is then prompted to enter a new
      release tag. To assist with this, the script displays the tag retrieved in
      the previous step, and validates the format of the inputted tag (vX.X.X). The
      user is also reminded to update the version field in package.json.
   1. **Tagging the new release:** The script then tags a new release and syncs the
      separate major tag (e.g. v1, v2) with the new release tag (e.g. v1.0.0,
      v2.1.2). When the user is creating a new major release, the script
      auto-detects this and creates a `releases/v#` branch for the previous major
      version.
   1. **Pushing changes to remote:** Finally, the script pushes the necessary
      commits, tags and branches to the remote repository. From here, you will need
      to create a new release in GitHub so users can easily reference the new tags
      in their workflows.
6. Merge the release branch into the main branch.


## License

By contributing to this project, you agree that your contributions will be licensed under the [LICENSE](../LICENSE) file in the root of this repository, and that you agree to the [Contributor License Agreement](#contributor-license-agreement).

### Licensing of new files

This project adheres to the [Software Package Data Exchange (SPDX)](https://spdx.dev/). SPDX is a standard format for communicating the components, licenses, and copyrights associated with software packages. It is a simple and concise way to communicate licensing information. Read more about how to define headers using the SPDX ids [here](https://spdx.dev/learn/handling-license-info/).

This license must be used for all new code, unless the containing project, module or externally-imported codebase uses a different license. If you can't put a header in the file due to its structure, please put it in a LICENSE file in the same directory.

```
// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: Apache-2.0

# SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
# SPDX-License-Identifier: Apache-2.0

<!--
   SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
   SPDX-License-Identifier: Apache-2.0
-->

SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
SPDX-License-Identifier: Apache-2.0
```

### MIT License

This license can be used for test scripts and other short code snippets, at the discretion of the author.

```
// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
// SPDX-License-Identifier: MIT

# SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
# SPDX-License-Identifier: MIT

<!--
   SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
   SPDX-License-Identifier: MIT
-->

SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital
SPDX-License-Identifier: MIT
```

## Code of Conduct

Please read our [Code of Conduct](../.github/CODE_OF_CONDUCT.md) before contributing.

## Contributor License Agreement

This is a human-readable summary of (and not a substitute for) the [full agreement](./CLA.md). This highlights only some of the key terms of the CLA. It has no legal value and you should carefully review all the terms of the [actual CLA before agreeing](./CLA.md).

* __Grant of copyright license__. You give Telefónica permission to use your copyrighted work in commercial products.
* __Grant of patent license__. If your contributed work uses a patent, you give Telefónica a license to use that patent including within commercial products. You also agree that you have permission to grant this license.
* __No Warranty or Support Obligations__. By making a contribution, you are not obligating yourself to provide support for the contribution, and you are not taking on any warranty obligations or providing any assurances about how it will perform.

The [CLA](./CLA.md) does not change the terms of the underlying license used by our software such as the Business Source License, Mozilla Public License, or MIT License. You are still free to use our projects within your own projects or businesses, republish modified source code, and more subject to the terms of the project license. Please reference the appropriate license for the project you're contributing to to learn more.
