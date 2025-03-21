# Check license compliance copilot instructions

## Preface

Read the README.md file to understand the project features.

## Style

- Always follow the same coding style as the existing code. Search for patterns in the code and follow them.
- Follow the eslint rules defined in the `./eslint.config.js` file when coding
- Always run the linter after modifying any file, and correct the syntax until it is valid. Example:
  ```bash
  pnpm lint .
  ```
- To improve linter performance, you can run it on a specific folder or file. Example:
  ```bash
  pnpm lint ./src/index.ts
  ```

## Testing

- Always write tests for the code you are implementing. Search for the file that contains the tests for the file you are modifying and add the necessary tests, or add a new file if necessary.
- The tests are written using the `jest` library.
- Unit tests are in the `./test/unit/specs/lib` and `./test/unit/specs/action` folders.
- Test files must have the extension `.spec.ts`.
- Always Run the tests to ensure that the code is working as expected, and that the tests are passing. Example:
  ```bash
  pnpm test:unit
  ```
- To improve test performance, you can run it on a specific folder or file. Example:
  ```bash
  pnpm test:unit ./src/index.test.ts
  ```
- Iterate on the tests, linting, and code until linting and tests pass.
