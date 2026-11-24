/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "./src/env.js";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  // A stray package-lock.json in the home folder confuses Next's workspace-root detection.
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default config;
