import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy policy · Guaca',
  description: 'What Guaca stores, why, and how to remove it.',
};

export default function Page() {
  return <LegalPage doc="privacy" />;
}
