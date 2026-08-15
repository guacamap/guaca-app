'use client';

import dynamic from 'next/dynamic';

const DeleteAccount = dynamic(() => import('@/components/DeleteAccount'), { ssr: false });

export default function Page() {
  return <DeleteAccount />;
}
