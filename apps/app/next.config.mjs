/** @type {import('next').NextConfig} */
const recording = process.env.GUACA_RECORDING === 'true';
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? (recording ? 'http://127.0.0.1:3011' : 'http://localhost:3001');

const nextConfig = {
  // A production build and a running dev server used to share .next, and a
  // build while dev was up corrupted it (five times in one project).
  // Give `next build` / `next start` their own directory; dev keeps .next.
  // Vercel's builder reads .next/routes-manifest.json and nothing else, so
  // there (VERCEL=1) the default stays.
  distDir: process.env.VERCEL ? '.next' : recording ? '.next-recording-build' : process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
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
