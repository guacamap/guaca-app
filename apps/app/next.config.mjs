/** @type {import('next').NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@guaca/ui'],
  async rewrites() {
    // Relative /api/* reaches the Fastify API without CORS, in dev and prod.
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
