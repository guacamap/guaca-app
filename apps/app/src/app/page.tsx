'use client';

import dynamic from 'next/dynamic';

/**
 * The product experience is a client-side state machine — it reads
 * location.search and localStorage on mount, so it renders client-only.
 * Route-level splitting (/map, /v/[qrToken], /spotter) lands with §4.1.
 */
const App = dynamic(() => import('@/App'), { ssr: false });

export default function Page() {
  return <App />;
}
