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
      // Single-business model: Partners/Tenants → Integrations; workspace pickers are gone.
      { source: '/campaigns', destination: '/integrations', permanent: false },
      { source: '/campaigns/:path*', destination: '/integrations', permanent: false },
      { source: '/tenants', destination: '/integrations', permanent: false },
      { source: '/tenants/chat', destination: '/integrations/chat', permanent: false },
      { source: '/tenants/partners', destination: '/integrations/partners', permanent: false },
      { source: '/tenants/publish', destination: '/messages/publish', permanent: false },
      { source: '/tenants/business-profile', destination: '/messages/publish', permanent: false },
      { source: '/tenants/:path*', destination: '/integrations', permanent: false },
      // Voice AI is split into Chat AI / Speak AI / Form; the wizard moved under Messages.
      { source: '/messages/voice', destination: '/messages/speak', permanent: false },
      { source: '/messages/connections', destination: '/messages', permanent: false },
      { source: '/wizard', destination: '/messages/wizard', permanent: false },
      { source: '/wizard/:slug/configure', destination: '/messages/wizard', permanent: false },
      { source: '/messages/wizard/:slug', destination: '/messages/wizard', permanent: false },
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
