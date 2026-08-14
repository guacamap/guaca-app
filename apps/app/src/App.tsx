import { useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button, InfoProvider, LanguageProvider } from '@guaca/ui'
import { RoleChooser } from './components/RoleChooser'
import { TouristView } from './components/TouristView'
import { SpotterView } from './components/SpotterView'
import { OperatorView } from './components/OperatorView'
import { JoinRole } from './components/JoinRole'

type Role = 'tourist' | 'spotter' | 'operator'

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://guaca.live'

export default function App() {
  return (
    <InfoProvider>
      <LanguageProvider>
        <GuacaExperience />
      </LanguageProvider>
    </InfoProvider>
  )
}

function GuacaExperience() {
  const initialRole = new URLSearchParams(window.location.search).get('role')
  const [role, setRole] = useState<Role | null>(
    initialRole === 'tourist' || initialRole === 'spotter' || initialRole === 'operator' ? initialRole : null,
  )
  /* Real registration gate: choosing a role opens the join screen once per
     role selection; registering (or skipping) enters the experience. */
  const [joined, setJoined] = useState(Boolean(initialRole))

  const chooseRole = (nextRole: Role) => {
    setRole(nextRole)
    setJoined(false)
  }

  return (
    <div className="guaca-page">
      <div className="guaca-phone">
        {!role && <RoleChooser onChoose={chooseRole} />}
        {role && !joined && <JoinRole role={role} onDone={() => setJoined(true)} onBack={() => setRole(null)} />}
        {role === 'tourist' && joined && <TouristView onRoleChange={() => setRole(null)} />}
        {role === 'spotter' && joined && <SpotterView onRoleChange={() => setRole(null)} />}
        {role === 'operator' && joined && <OperatorView />}

        {role && joined && (
          <Button
            type="button"
            onClick={() => setRole(null)}
            className="absolute bottom-[92px] right-4 z-[700] h-10 rounded-full bg-guaca-ocean-deep/82 px-3 text-[11px] font-bold text-white shadow-xl shadow-guaca-ocean-deep/25 backdrop-blur-md hover:bg-guaca-ocean-deep"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Role
          </Button>
        )}

        {!role && (
          <a
            href={LANDING_URL}
            aria-label="Back to Guaca website"
            className="absolute left-4 top-4 z-[800] grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-guaca-ocean-deep/72 text-white shadow-lg backdrop-blur-md hover:bg-guaca-ocean-deep"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </a>
        )}
      </div>
    </div>
  )
}
