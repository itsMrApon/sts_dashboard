import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/agents/**',
          '**/primeone_Insurance/**',
          '**/.cursor/**',
          '**/packages/**/dist/**',
        ],
      }
    }
    return config
  },
  async redirects() {
    return [
      { source: '/campaigns', destination: '/tenants', permanent: true },
      { source: '/campaigns/business-profile', destination: '/tenants/business-profile', permanent: true },
      { source: '/campaigns/:tenantId', destination: '/tenants/:tenantId', permanent: true },
    ]
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
