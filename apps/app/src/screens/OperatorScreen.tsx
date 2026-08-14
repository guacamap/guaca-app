import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { OperatorView } from '../components/OperatorView'

export default function OperatorScreen() {
  return (
    <Providers>
      <PhoneShell showRoleSwitch>
        <OperatorView />
      </PhoneShell>
    </Providers>
  )
}
