import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { TouristGate } from '../components/TouristGate'
import { TouristView } from '../components/TouristView'

export default function MapScreen() {
  return (
    <Providers>
      <PhoneShell>
        <TouristGate>
          <TouristView />
        </TouristGate>
      </PhoneShell>
    </Providers>
  )
}
