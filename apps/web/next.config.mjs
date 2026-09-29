import path from "path";
import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",                              // self-contained server for the Docker image
  outputFileTracingRoot: path.join(here, "../.."),   // monorepo root (npm workspaces)
  outputFileTracingIncludes: { "/**": ["./data/**"] },
};
