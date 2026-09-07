'use client';

import dynamic from 'next/dynamic';

const MerchantScreen = dynamic(() => import('@/screens/MerchantScreen'), { ssr: false });

export default function Page() {
  return <MerchantScreen />;
}
