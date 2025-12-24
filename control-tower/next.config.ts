import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Recommended for AWS/Docker environments to reduce bundle size
  output: 'standalone',

  // 2. Helps prevent build failures if you have strict linting/TS rules
  typescript: {
    ignoreBuildErrors: false, 
  },
};

export default nextConfig;