import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Terms of use · Guaca',
  description: 'The terms that apply when you use Guaca.',
};

export default function Page() {
  return <LegalPage doc="terms" />;
}
