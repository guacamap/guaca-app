import { useState } from 'react'
import { ArrowRight, Compass, Palmtree, Store, Trophy } from 'lucide-react'
import { InstallApp } from './InstallApp'
import { JoinBrand, JoinScene, Wave } from './JoinScene'

type Role = 'tourist' | 'spotter'

interface RoleChooserProps {
  onChoose: (role: Role) => void
  /** Returning users: route to whichever session already exists. */
  onLogin?: () => void
}

/** Businesses register on the website — never an in-app role (§ rules). */
const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://guaca.live'
const BUSINESS_URL = `${LANDING_URL}/#businesses`

/** Per-role colour, as explicit classes so Tailwind can see them. */
const TONE = {
  teal: {
    text: 'text-guaca-teal',
    border: 'border-guaca-teal/80',
    borderHover: 'hover:border-guaca-teal',
    glow: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_0_24px_-6px_rgba(13,139,139,0.35)]',
    ringHover: 'group-hover:bg-guaca-teal/15',
  },
  coral: {
    text: 'text-guaca-coral',
    border: 'border-guaca-coral/85',
    borderHover: 'hover:border-guaca-coral',
    glow: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_0_24px_-6px_rgba(232,115,90,0.35)]',
    ringHover: 'group-hover:bg-guaca-coral/15',
  },
} as const

const roles = [
  {
    id: 'tourist' as Role,
    title: 'Tourist',
    description: 'Explore Caribbean communities',
    helper: 'Live map · real local info',
    icon: Compass,
    tone: TONE.teal,
  },
  {
    id: 'spotter' as Role,
    title: 'Spotter',
    description: 'Help your community earn rewards',
    helper: 'Photo missions · badges · points',
    icon: Trophy,
    tone: TONE.coral,
  },
]

export function RoleChooser({ onChoose, onLogin }: RoleChooserProps) {
  const [hoveredRole, setHoveredRole] = useState<Role | null>(null)

  return (
    <JoinScene>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-7 pt-16 sm:pt-20 md:max-w-[52rem] md:pt-8">
        <JoinBrand />

        {/* Choice: stacked glass cards on a phone; on a wider screen the two
            roles sit square, side by side, inside one glass panel with the
            business row beneath. */}
        <div className="mt-6 md:rounded-[30px] md:border md:border-white/25 md:bg-[rgba(60,140,160,0.16)] md:p-6 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_30px_60px_-30px_rgba(0,0,0,0.6)] md:backdrop-blur-xl">
          <h1 className="mb-4 flex items-center justify-center gap-3 text-center text-[17px] font-extrabold tracking-[-.01em] text-white drop-shadow md:mb-5 md:text-[22px]">
            <Wave /> How do you want to join? <Wave />
          </h1>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {roles.map((role) => {
              const Icon = role.icon
              const active = hoveredRole === role.id
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onChoose(role.id)}
                  onMouseEnter={() => setHoveredRole(role.id)}
                  onMouseLeave={() => setHoveredRole(null)}
                  onFocus={() => setHoveredRole(role.id)}
                  onBlur={() => setHoveredRole(null)}
                  className={`group flex w-full items-center gap-4 rounded-[22px] border-[1.5px] bg-[rgba(40,110,130,0.26)] p-4 text-left backdrop-blur-lg transition-[transform,border-color,background-color] duration-150 ease-out hover:bg-[rgba(40,110,130,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:flex-col md:items-center md:gap-3 md:px-6 md:py-6 md:text-center ${role.tone.border} ${role.tone.borderHover} ${role.tone.glow} ${active ? '-translate-y-0.5' : ''}`}
                >
                  <span className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18),0_0_0_7px_rgba(255,255,255,0.06)] md:h-[92px] md:w-[92px] md:shadow-[0_0_0_5px_rgba(255,255,255,0.18),0_0_0_9px_rgba(255,255,255,0.06)]">
                    <Icon aria-hidden="true" className={`h-8 w-8 md:h-12 md:w-12 ${role.tone.text}`} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[21px] font-extrabold leading-tight md:text-[24px] ${role.tone.text}`}>{role.title}</span>
                    <span className="mt-1 block text-[14px] font-semibold leading-snug text-white/95 md:mx-auto md:mt-1 md:max-w-[20ch] md:text-[15px]">{role.description}</span>
                    <span className={`mt-1.5 block text-[12px] font-semibold md:hidden ${role.tone.text}`}>{role.helper}</span>
                  </span>
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-[1.5px] transition-[background-color,transform] duration-150 md:mt-1 ${role.tone.border} ${role.tone.ringHover} ${active ? 'translate-x-0.5 md:translate-x-0 md:translate-y-0.5' : ''}`}>
                    <ArrowRight aria-hidden="true" className={`h-5 w-5 ${role.tone.text}`} />
                  </span>
                </button>
              )
            })}

            {/* Businesses are not an in-app role: this hands off to the site. */}
            <a
              href={BUSINESS_URL}
              className="group flex w-full items-center gap-4 rounded-[22px] border-[1.5px] border-guaca-teal/60 bg-[rgba(40,110,130,0.26)] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-lg transition-[transform,border-color,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-guaca-teal hover:bg-[rgba(40,110,130,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:col-span-2 md:px-5 md:py-4"
            >
              <span className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18),0_0_0_7px_rgba(255,255,255,0.06)] md:h-16 md:w-16">
                <Store aria-hidden="true" className="h-8 w-8 text-guaca-teal md:h-7 md:w-7" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[21px] font-extrabold leading-tight text-guaca-teal md:text-[18px]">
                  Business<span className="hidden md:inline"> access</span>
                </span>
                <span className="mt-1 block text-[14px] font-semibold leading-snug text-white/95 md:mt-1 md:text-[14px]">
                  <span className="md:hidden">Publish current local information</span>
                  <span className="hidden md:inline">Partner with Guaca to build stronger communities</span>
                </span>
                <span className="mt-1.5 block text-[12px] font-semibold text-guaca-teal md:hidden">Coverage gaps · live demand</span>
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[1.5px] border-guaca-teal/70 transition-[background-color,transform] duration-150 group-hover:bg-guaca-teal/15 group-hover:translate-x-0.5">
                <ArrowRight aria-hidden="true" className="h-5 w-5 text-guaca-teal" />
              </span>
            </a>
          </div>
        </div>

        {/* Store-free install — the app can live on the home screen today. */}
        <div className="mt-4">
          <InstallApp tone="dark" />
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-guaca-teal/80 bg-[rgba(14,58,76,0.5)] px-4 py-2 text-[12px] font-bold text-white/95 backdrop-blur-md md:text-[13px]">
            <Palmtree className="h-3.5 w-3.5 text-guaca-teal" />
            <span>Caribbean beta · coverage grows locally</span>
          </div>
          <p className="mt-4 text-[13px] text-white/85">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onLogin}
              className="rounded font-bold text-guaca-teal underline decoration-guaca-teal/60 underline-offset-2 hover:decoration-guaca-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Log in
            </button>
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-white/80">
            <Store aria-hidden="true" className="h-3.5 w-3.5" />
            <span>A business?</span>
            <a
              href={BUSINESS_URL}
              className="rounded font-bold text-guaca-teal underline decoration-guaca-teal/60 underline-offset-2 hover:decoration-guaca-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Register on guaca.live
            </a>
          </p>
        </div>
      </div>
    </JoinScene>
  )
}
