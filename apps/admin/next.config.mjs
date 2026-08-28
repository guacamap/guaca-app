/** @type {import('next').NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig = {
  // A production build and a running dev server used to share .next, and a
  // build while dev was up corrupted it (five times in one project).
  // Give `next build` / `next start` their own directory; dev keeps .next.
  // Vercel's builder reads .next/routes-manifest.json and nothing else, so
  // there (VERCEL=1) the default stays.
  distDir: process.env.VERCEL ? '.next' : process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js needs inline scripts for hydration; 'unsafe-inline'
              // for styles only (Tailwind injects at build)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com",
              "font-src 'self'",
              "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
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
