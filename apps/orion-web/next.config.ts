import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo: trace files from repo root (avoids wrong lockfile inference)
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
