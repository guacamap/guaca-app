'use client';

import dynamic from 'next/dynamic';

const MapScreen = dynamic(() => import('@/screens/MapScreen'), { ssr: false });

export default function Page() {
  return <MapScreen />;
}
