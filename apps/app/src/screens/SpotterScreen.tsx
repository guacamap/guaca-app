import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { SpotterGate } from '../components/SpotterGate'
import { SpotterView } from '../components/SpotterView'

export default function SpotterScreen() {
  return (
    <Providers>
      <PhoneShell>
        <SpotterGate>
          <SpotterView />
        </SpotterGate>
      </PhoneShell>
    </Providers>
  )
}
