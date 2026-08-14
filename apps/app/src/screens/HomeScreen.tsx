import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { RoleChooser } from '../components/RoleChooser'

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://guaca.live'

export default function HomeScreen() {
  const router = useRouter()
  return (
    <Providers>
      <PhoneShell>
        <RoleChooser onChoose={(role) => router.push(`/${role === 'tourist' ? 'map' : role}`)} />
        <a
          href={LANDING_URL}
          aria-label="Back to Guaca website"
          className="absolute left-4 top-4 z-[800] grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-guaca-ocean-deep/72 text-white shadow-lg backdrop-blur-md hover:bg-guaca-ocean-deep"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </a>
      </PhoneShell>
    </Providers>
  )
}
