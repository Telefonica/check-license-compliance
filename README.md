# Check License Compliance

Checks that repository dependencies are compliant with allowed licenses according to a given configuration.

## Table of Contents

- [Preface](#preface)
- [Usage](#usage)
  - [PR comments](#pr-comments)
- [Configuration](#configuration)
  - [Configuration file](#configuration-file)
  - [Inputs](#inputs)
  - [Configuration example](#configuration-example)
- [How it works](#how-it-works)
  - [Node.js](#nodejs)
- [Outputs](#outputs)
- [Contributing](#contributing)
- [License](#license)

## Preface

This repository contains a GitHub Action that checks that repository dependencies are compliant with allowed licenses according to a given configuration.

For the moment, it supports the following languages:

* Node.js - License check using the [`license-checker` library](https://github.com/davglass/license-checker).

> [!IMPORTANT]
> It requires dependencies to be installed in the repository. If you are using a package manager, make sure to run the installation command before running this action.

For better user experience in PRs, it also includes a Github Composite Action that performs the check and posts the results into a comment in the PR. Read the [PR comments](#pr-comments) section for more information.

## Usage

Create a configuration file `check-license-compliance.config.yml` at the root of your repository, containing the [forbidden, allowed, or warning licenses](#configuration).

> [!NOTE]
> Using a [configuration file](#configuration-file) is optional. You can also use the [action inputs](#inputs) to define the [configuration](#configuration).

```yaml
# License Compliance configuration
licenses:
  allowed:
    - Apache-2.0
    - MIT
  warning:
    - LGPL-3.0
    - LGPL-2.0
    - MPL-2.0
  forbidden:
    - AGPL-3.0
    - GPL-2.0
failOnForbidden: true
failOnWarning: false
```

Example of a GitHub Actions workflow file:

```yaml
name: Check SPDX headers

on: push

jobs:
  check-license-compliance:
    name: Check License Compliance
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install Node dependencies
        run: npm ci

      - name: Check dependencies licenses
        uses: Telefonica/check-license-compliance@v1
```

That's it! The action will check the dependencies according to the configuration file on every push.

### PR comments

This repository also includes a Github Composite Action that performs the check and posts the results into a comment in the PR.

![PR comment](./docs/pr-comment.png)

The composite action accepts the [same inputs as the main action](#inputs), except for:
  * `reporter` - The `reporter` option is always set to `markdown`.

Here you have an example of a GitHub Actions workflow file using the `check-and-comment` action:

```yaml
name: Check License Compliance

on: pull_request

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  check-license-compliance:
    name: Check License Compliance
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install Node dependencies
        run: npm ci

      - name: Check Licenses
        uses: Telefonica/check-license-compliance/.github/actions/check-and-comment@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration

### Configuration file

The configuration file is a YAML file that must be placed at the root of your repository by default (you can also change the path by using the [action inputs](#inputs)). It can contain the following properties:

* `licenses`: Object containing details about the licenses that are allowed, forbidden, or should produce a warning. Licenses are identified by their [SPDX identifier](https://spdx.org/licenses/). Read [How it works](#how-it-works) for more information about how the action checks the licenses.
  * `allowed`: Array of strings with the allowed licenses. 
  * `forbidden`: Array of strings with the forbidden licenses.
  * `warning`: Array of strings with the licenses that should produce a warning.
* `failOnForbidden`: Boolean indicating if the check should fail when a forbidden license is found.
* `failOnWarning`: Boolean indicating if the check should fail when a warning license is found.
* `failOnNotValid`: Boolean indicating if the check should fail (exit 1) when the result is not valid according to the dependencies and the `failOnForbidden` and `failOnWarning` properties. Default is `true`.
* `licenseCheckerOptions`: Object with the options that are passed to the [`license-checker` library](https://github.com/davglass/license-checker) on each different type of check. So, __it is only useful when checking Node dependencies__. You can find the available options [here](https://github.com/davglass/license-checker#options).
  * `global`: Object with the global options. These options are applied both when checking "warning" and "forbidden" licenses.
  * `warning`: Object with the options that are applied when checking "warning" licenses. They are merged with the global options. By default, the `unknown` option is set to `true`. You should redefine it if you want to not produce a warning for unknown licenses.
  * `forbidden`: Object with the options that are applied when checking "forbidden" licenses. They are merged with the global options.
* `reporter`: Reporter to use. Possible values are `text`, `markdown` and `json`. Default is `text`. Further info in the [Reporters](#reporters) section.
* `log`: Log level to use. Possible values are `silly`, `debug`, `info`, `warning` and `error`. Default is `info`. This option enables logs for the headers check. You can also enable logs for the action itself _(useful if you find any problem while the action is loading the configuration, for example)_ by setting the `ACTIONS_STEP_DEBUG` secret to `true`.

> [!TIP]
> Read the [How it works](#how-it-works) section to understand how the action checks the licenses for better understanding of the configuration options.

### Inputs

The action also allows to set the configuration by using inputs. When defined, they will override the values in the [configuration file](#configuration-file). The inputs are:

* `config-file`: Path to the configuration file. Default is `check-license-compliance.config.yml`.
* `reporter`: Reporter to use. Possible values are `text`, `markdown` and `json`. Default is `text`.
* `log`: Log level to use. Possible values are `silly`, `debug`, `info`, `warning` and `error`. Default is `info`.
* `fail-on-forbidden`: Boolean value to determine if the action should fail when a file does not have the correct headers. Default is `true`.
* `fail-on-warning`: Boolean value to determine if the action should fail when a file does not have the correct headers. Default is `true`.
* `fail-on-not-valid`: Boolean value to determine if the action should fail (exit 1) when the result is not valid according to the dependencies and the `fail-on-forbidden` and `fail-on-warning` properties. Default is `true`.
* `config`: Multiline string with the whole [configuration](#configuration) expressed as a YAML object as in the configuration file. It will extend the values defined in the [configuration file](#configuration-file). Any config value that is defined in other inputs will override the values here.
    Example:

    ```yaml
    config: |
      licenses:
        allowed:
          - Apache-2.0
          - MIT
      failOnForbidden: true
    ```

> [!WARNING]
> Note that some properties are defined in camelCase in the configuration file, while they are defined in kebab-case in the inputs. This is because the configuration file tries to follow NodeJs conventions in order to pass the values directly to the underlying library, while the inputs follow a GitHub Actions convention.

### Configuration example

> [!TIP]
> Note that you can use the inputs to override the values in the configuration file, or to define the whole configuration if you don't want to use a file.

So, you can use the configuration file, the inputs, or both. The action will merge the values in the following order:

1. Values in the configuration file.
2. Values in the `config` input.
6. The rest of the inputs.

Example of a complex configuration using both the configuration file and the inputs:

```yaml
# Configuration file
rules:
  - name: "Source code"
    headers:
      - files:
          - "**/*.js"
        license:
          - "Apache-2.0"
        copyright: "My Company"
ignore: "**/node_modules/**"
```

```yaml
# GitHub Actions workflow file with inputs
name: Check License Compliance

on: push

jobs:
  check-license-compliance:
    name: Check Licenses
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install Node dependencies
        run: npm ci

      - name: Check
        uses: Telefonica/check-license-compliance@v1
        with:
          config-file: "check-licenses.config.yml"
          # Properties with preference over values defined in any other place
          reporter: "markdown"
          log: "debug"
          fail-on-forbidden: false
          # This will extend the values in the configuration file
          config: |
            licenses:
              allowed:
                - Apache-2.0
                - MIT
            failOnForbidden: true
```

## How it works

### Node.js

Node.js licenses are checked using the [`license-checker` library](https://github.com/davglass/license-checker). But it provides a layer on top of it to enable defining licenses as forbidden or warning, and to fail or not the check depending on the result of each one separately.

The action executed the `license-checker` library two times with the following options:

1. Check forbidden: It executes the check, passing as exclusions the licenses in the `allowed` and `warning` arrays. If any license is found, it will consider the dependencies not valid if the `failOnForbidden` property is set to `true`.
2. Check warning: It executes the check, passing as exclusions the licenses in the `allowed` and `forbidden` arrays. If any license is found, it will consider the dependencies not valid if the `failOnWarning` property is set to `true`.

The action will return a report with the details of the check, including the dependencies that are not compliant, their installation path, the license they have, etc.

> [!TIP]
> You can define the options that are passed to the `license-checker` library on each different type of check by using the `licenseCheckerOptions` property in the [configuration](#configuration).

## Outputs

The action returns the following outputs:

* `found-forbidden`: A boolean value indicating whether any forbidden license was found.
* `found-warning`: A boolean value indicating whether any warning license was found.
* `valid`: A boolean value indicating whether the check is valid according to the dependencies and the `failOnForbidden` and `failOnWarning` properties.
* `report`: A report containing details about the result of the check. The report can be returned in different formats, that can be defined by using the [`reporter` configuration property](#configuration). The possible values are:
  * `text`: Generates a text report. This is the default reporter.
  * `markdown`: Generates a markdown report. This is very useful if you want to send the results to a GitHub comment in a PR, for example.
  * `json`: Generates a JSON report. This is useful if you want to process the results in a script, for example. __Note that Github Actions outputs are always strings, so you will need to parse the JSON in your workflow.__ The JSON report contains all details about the compliance check, including the dependencies that are not compliant, their installation path, the license they have, etc.

## Contributing

Please read our [Contributing Guidelines](./.github/CONTRIBUTING.md) for details on how to contribute to this project before submitting a pull request.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](./LICENSE) file for details. Read the Apache-2.0 FAQ at https://www.apache.org/foundation/license-faq.html
