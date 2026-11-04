import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.DARCIANA_TEST_BUILD_DIR || '.next',
  typescript: {
    tsconfigPath: process.env.DARCIANA_TEST_BUILD_DIR
      ? 'tsconfig.admin-tests.json'
      : 'tsconfig.json',
  },
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default nextConfig;
