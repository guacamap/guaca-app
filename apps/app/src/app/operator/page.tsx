'use client';

import dynamic from 'next/dynamic';

const OperatorScreen = dynamic(() => import('@/screens/OperatorScreen'), { ssr: false });

export default function Page() {
  return <OperatorScreen />;
}
