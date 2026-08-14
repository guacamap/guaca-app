'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const VillaScreen = dynamic(() => import('@/screens/VillaScreen'), { ssr: false });

export default function Page() {
  const params = useParams<{ qrToken: string }>();
  return <VillaScreen qrToken={params.qrToken} />;
}
