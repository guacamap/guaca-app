import { useRouter } from 'next/navigation'
import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { SpotterView } from '../components/SpotterView'

export default function SpotterScreen() {
  const router = useRouter()
  return (
    <Providers>
      <PhoneShell showRoleSwitch>
        <SpotterView onRoleChange={() => router.push('/')} />
      </PhoneShell>
    </Providers>
  )
}
