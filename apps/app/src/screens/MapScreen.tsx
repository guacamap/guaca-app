import { useRouter } from 'next/navigation'
import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { TouristGate } from '../components/TouristGate'
import { TouristView } from '../components/TouristView'

export default function MapScreen() {
  const router = useRouter()
  return (
    <Providers>
      <PhoneShell showRoleSwitch>
        <TouristGate>
          <TouristView onRoleChange={() => router.push('/')} />
        </TouristGate>
      </PhoneShell>
    </Providers>
  )
}
