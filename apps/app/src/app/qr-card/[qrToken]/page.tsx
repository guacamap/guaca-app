'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const QrCardScreen = dynamic(() => import('@/screens/QrCardScreen'), { ssr: false });

export default function Page() {
  const params = useParams<{ qrToken: string }>();
  return <QrCardScreen qrToken={params.qrToken} />;
}
