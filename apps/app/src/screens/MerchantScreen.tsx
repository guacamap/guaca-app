import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { MerchantGate } from '../components/MerchantGate'
import { MerchantView } from '../components/MerchantView'

export default function MerchantScreen() {
  return (
    <Providers>
      <PhoneShell>
        <MerchantGate>
          <MerchantView />
        </MerchantGate>
      </PhoneShell>
    </Providers>
  )
}
