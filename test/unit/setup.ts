// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

// @ts-expect-error Partial mock
jest.mock<typeof import("../../src/lib/Paths")>("../../src/lib/Paths", () => ({
  ROOT_PATH: "/mocked/root/path",
  SPDX_LICENSE_IDS_PATH: new URL(
    "file:///mocked/path/to/spdx-license-ids.json",
  ),
}));

jest.mock<typeof import("strip-indent")>("strip-indent", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((text) => text),
}));

// @ts-expect-error Partial mock
jest.mock<typeof import("p-queue")>("p-queue", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((text) => text),
}));

jest.mock<typeof import("indent-string")>("indent-string", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((text) => text),
}));

// @ts-expect-error Partial mock
jest.mock<typeof import("chalk")>("chalk", () => ({
  gray: jest.fn().mockImplementation((text) => text),
}));

// @ts-expect-error Partial mock
jest.mock<typeof import("spdx-satisfies")>("spdx-satisfies", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => true),
}));
