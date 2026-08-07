import VillaLanding from './villa-landing';

export default async function Page({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  return <VillaLanding qrToken={qrToken} />;
}
