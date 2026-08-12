/** @type {import('next').NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Parity with the Vite dev proxy: components may fetch relative `/api/*`
    // (JoinRole does) and reach the Fastify API without CORS.
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
