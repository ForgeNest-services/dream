import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    ENVIRO: process.env.ENVIRO || 'prod',
  },
};

export default nextConfig;
