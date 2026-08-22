/** @type {import('next').NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@guaca/ui'],
  async rewrites() {
    // Same-origin proxy to the Fastify API: the operator token never leaves
    // this origin, and no CORS surface is needed for the panel.
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
