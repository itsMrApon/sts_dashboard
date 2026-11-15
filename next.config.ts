import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones on the same Wi-Fi open dev links by network address (see lib/offers/publicBaseUrl).
  allowedDevOrigins: ['192.168.86.182', '192.168.*.*', '10.*.*.*', '*.ngrok-free.app', '*.ngrok-free.dev'],
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
      { source: '/tenants/publish', destination: '/services/publish', permanent: false },
      { source: '/tenants/business-profile', destination: '/services/publish', permanent: false },
      { source: '/tenants/:path*', destination: '/integrations', permanent: false },
      // Messages was renamed to Services; old links and bookmarks keep working.
      { source: '/messages', destination: '/services', permanent: true },
      { source: '/messages/voice', destination: '/services/speak', permanent: false },
      { source: '/messages/connections', destination: '/services', permanent: false },
      { source: '/messages/wizard/:slug', destination: '/services/wizard', permanent: false },
      { source: '/messages/:path*', destination: '/services/:path*', permanent: true },
      { source: '/wizard', destination: '/services/wizard', permanent: false },
      { source: '/wizard/:slug/configure', destination: '/services/wizard', permanent: false },
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
