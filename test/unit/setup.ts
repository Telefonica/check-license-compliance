// SPDX-FileCopyrightText: 2024 Telefónica Innovación Digital and contributors
// SPDX-License-Identifier: Apache-2.0

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
jest.mock<typeof import("strip-indent")>("strip-indent", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((text) => text),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
jest.mock<typeof import("indent-string")>("indent-string", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((text) => text),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
jest.mock<typeof import("chalk")>("chalk", () => ({
  gray: jest.fn().mockImplementation((text) => text),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
jest.mock<typeof import("../../src/lib/spdx-satisfies")>(
  "../../src/lib/spdx-satisfies",
  () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => true),
  }),
);
