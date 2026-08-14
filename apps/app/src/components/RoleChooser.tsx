import { useState } from 'react'
import { ArrowRight, Compass, Sparkles, Trophy, Store } from 'lucide-react'
import { Button } from '@guaca/ui'
import { GuacaLogo } from '@guaca/ui'
import { PalmFrondLeft, PalmFrondRight } from '@guaca/ui'

type Role = 'tourist' | 'spotter' | 'operator'

interface RoleChooserProps {
  onChoose: (role: Role) => void
}

const roles = [
  {
    id: 'tourist' as Role,
    title: 'Tourist',
    description: 'Explore Caribbean communities',
    helper: 'Live map · real local info',
    icon: Compass,
    accent: 'text-guaca-teal',
    ring: 'ring-guaca-teal/30',
  },
  {
    id: 'spotter' as Role,
    title: 'Spotter',
    description: 'Help your community earn rewards',
    helper: 'Photo missions · badges · points',
    icon: Trophy,
    accent: 'text-guaca-coral',
    ring: 'ring-guaca-coral/30',
  },
  {
    id: 'operator' as Role,
    title: 'Business',
    description: 'Publish current local information',
    helper: 'Coverage gaps · live demand',
    icon: Store,
    accent: 'text-guaca-ocean',
    ring: 'ring-guaca-ocean/30',
  },
]

export function RoleChooser({ onChoose }: RoleChooserProps) {
  const [hoveredRole, setHoveredRole] = useState<Role | null>('tourist')

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden bg-guaca-ocean-deep text-white sm:min-h-full">
      {/* Ocean photo background */}
      <div className="absolute inset-0 bg-[url('/assets/landing-caribbean-phone.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-b from-guaca-sea/30 via-guaca-ocean/50 to-guaca-ocean-deep/95" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-guaca-ocean-deep" />

      {/* Palm frond corners */}
      <PalmFrondLeft className="pointer-events-none absolute left-[-10px] top-[-10px] h-44 w-32 opacity-80" />
      <PalmFrondRight className="pointer-events-none absolute right-[-10px] top-[-10px] h-44 w-32 opacity-80" />

      <div className="relative z-10 flex flex-1 flex-col px-7 pb-7 pt-16 sm:pt-20">
        {/* Brand hero */}
        <div className="flex flex-1 flex-col items-center pt-4">
          <GuacaLogo variant="reversed" className="h-24 drop-shadow-[0_7px_18px_rgba(0,0,0,0.4)]" />
          <p className="mt-2 text-[13px] font-semibold text-white/92 drop-shadow">
            Live map. Real info. Local rewards.
          </p>
        </div>

        {/* Role cards */}
        <div className="mt-4 space-y-3">
          <p className="mb-4 text-center text-[13px] font-semibold text-white/90">
            How do you want to join?
          </p>

          {roles.map((role) => {
            const Icon = role.icon
            const active = hoveredRole === role.id

            return (
              <Button
                key={role.id}
                type="button"
                variant="ghost"
                onClick={() => onChoose(role.id)}
                onMouseEnter={() => setHoveredRole(role.id)}
                onMouseLeave={() => setHoveredRole(null)}
                className={`h-auto min-h-[76px] w-full justify-start rounded-3xl border border-white/62 bg-guaca-sand-light/94 p-3.5 text-left text-guaca-ink shadow-xl shadow-guaca-ocean-deep/18 backdrop-blur-md transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-white ${active ? '-translate-y-0.5 shadow-2xl' : ''}`}
              >
                <div className={`mr-4 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/72 ring-2 ${role.ring} shadow-inner`}>
                  <Icon aria-hidden="true" className={`h-7 w-7 ${role.accent}`} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden="true" className={`h-4 w-4 ${role.accent}`} />
                    <span className={`text-[15px] font-extrabold ${role.accent}`}>
                      {role.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] font-semibold text-guaca-ink/78">
                    {role.description}
                  </p>
                  <p className="mt-0.5 text-[10px] text-guaca-ink/44">
                    {role.helper}
                  </p>
                </div>
                <ArrowRight aria-hidden="true" className={`h-4 w-4 shrink-0 text-guaca-ink/45 transition-transform duration-150 ease-out ${active ? 'translate-x-0.5' : ''}`} />
              </Button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/86 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-guaca-mango-light" />
            <span>Caribbean beta · coverage grows locally</span>
          </div>
          <p className="mt-4 text-[11px] text-white/80">
            Already have an account? <span className="font-bold underline decoration-white/60">Log in</span>
          </p>
        </div>
      </div>
    </div>
  )
}
