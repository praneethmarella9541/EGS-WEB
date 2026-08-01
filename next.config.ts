import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app lives inside the Expo repo, which has its own lockfile one level up.
  // Pin the trace root to `web/` so Next stops guessing (and warning) about which
  // lockfile is the project root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
