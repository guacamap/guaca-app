import type { Metadata } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: 'Guaca Admin',
  description: 'Operator panel — token-gated, audit-backed.',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-64.png', sizes: '64x64', type: 'image/png' },
    ],
    shortcut: '/brand/favicon-32.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
