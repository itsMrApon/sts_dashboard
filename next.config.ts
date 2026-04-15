import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/campaigns', destination: '/tenants', permanent: true },
      { source: '/campaigns/business-profile', destination: '/tenants/business-profile', permanent: true },
      { source: '/campaigns/:tenantId', destination: '/tenants/:tenantId', permanent: true },
    ]
  },
  compiler: {
    removeConsole: process. env.NODE_ENV === 'production',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
