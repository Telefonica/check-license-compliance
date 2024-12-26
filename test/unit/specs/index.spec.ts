// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

import * as main from "../../../src/main";

// Mock the action's entrypoint
const runMock = jest.spyOn(main, "run").mockImplementation();

describe("index", () => {
  it("calls run when imported", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../../../src/index");

    expect(runMock).toHaveBeenCalled();
  });
});
