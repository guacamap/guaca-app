'use client';

import dynamic from 'next/dynamic';

const SpotterScreen = dynamic(() => import('@/screens/SpotterScreen'), { ssr: false });

export default function Page() {
  return <SpotterScreen />;
}
