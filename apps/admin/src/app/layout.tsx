import type { Metadata } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: 'Guaca Admin',
  description: 'Operator panel — token-gated, audit-backed.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
