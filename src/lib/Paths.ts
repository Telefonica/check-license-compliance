import path from "node:path";

const ENVIRONMENT = process.env.NODE_ENV || "production";

const isDevelopment = ENVIRONMENT === "development";

export const ROOT_PATH = isDevelopment
  ? path.resolve(import.meta.dirname, "..", "..")
  : path.resolve(import.meta.dirname, "..");
