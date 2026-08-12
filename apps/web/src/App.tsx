import { useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoleChooser } from './components/RoleChooser'
import { TouristView } from './components/TouristView'
import { SpotterView } from './components/SpotterView'
import { OperatorView } from './components/OperatorView'
import { MarketingLanding } from './components/MarketingLanding'
import { JoinRole } from './components/JoinRole'
import { InfoProvider } from './components/InfoStore'
import { LanguageProvider } from './lib/i18n'

type Role = 'tourist' | 'spotter' | 'operator'

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
  const [showApp, setShowApp] = useState(
    new URLSearchParams(window.location.search).get('view') === 'app' || Boolean(initialRole),
  )
  /* Real registration gate: choosing a role opens the join screen once per
     role selection; registering (or skipping) enters the experience. */
  const [joined, setJoined] = useState(Boolean(initialRole))

  const chooseRole = (nextRole: Role) => {
    setRole(nextRole)
    setJoined(false)
  }

  if (!showApp) {
    return <MarketingLanding />
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

        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Back to Guaca website"
          onClick={() => setShowApp(false)}
          className={`absolute left-4 z-[800] h-11 w-11 rounded-full border border-white/35 bg-guaca-ocean-deep/72 text-white shadow-lg backdrop-blur-md hover:bg-guaca-ocean-deep ${role ? 'bottom-[92px]' : 'top-4'}`}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
