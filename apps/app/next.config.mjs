/** @type {import('next').NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig = {
  // A production build and a running dev server used to share .next, and a
  // build while dev was up corrupted it (five times in one project).
  // Give `next build` / `next start` their own directory; dev keeps .next.
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
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
