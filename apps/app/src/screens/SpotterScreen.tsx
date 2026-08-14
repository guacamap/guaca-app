import { useRouter } from 'next/navigation'
import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { SpotterGate } from '../components/SpotterGate'
import { SpotterView } from '../components/SpotterView'

export default function SpotterScreen() {
  const router = useRouter()
  return (
    <Providers>
      <PhoneShell showRoleSwitch>
        <SpotterGate>
          <SpotterView onRoleChange={() => router.push('/')} />
        </SpotterGate>
      </PhoneShell>
    </Providers>
  )
}
