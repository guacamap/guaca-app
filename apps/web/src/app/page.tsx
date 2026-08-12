'use client';

import dynamic from 'next/dynamic';

/**
 * The experience is a client-side state machine ported from the Vite SPA —
 * it reads location.search and localStorage on mount, so it renders
 * client-only. Splitting it into real routes belongs to the §4.1 build.
 */
const App = dynamic(() => import('@/App'), { ssr: false });

export default function Page() {
  return <App />;
}
