import { useState } from 'react'
import { ArrowRight, Compass, Palmtree, Store, Trophy } from 'lucide-react'
import { InstallApp } from './InstallApp'
import { GuacaLogo } from '@guaca/ui'
import { PalmFrondLeft, PalmFrondRight } from '@guaca/ui'

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
    border: 'border-guaca-teal/70',
    borderHover: 'hover:border-guaca-teal',
    glow: 'shadow-[0_0_0_1px_rgba(13,139,139,0.25),0_18px_40px_-16px_rgba(0,0,0,0.6)]',
    ringHover: 'group-hover:bg-guaca-teal/15',
  },
  coral: {
    text: 'text-guaca-coral',
    border: 'border-guaca-coral/75',
    borderHover: 'hover:border-guaca-coral',
    glow: 'shadow-[0_0_0_1px_rgba(232,115,90,0.25),0_18px_40px_-16px_rgba(0,0,0,0.6)]',
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

/** The little "~~~" beside the heading. */
function Wave({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 8" className={`h-2 w-7 text-guaca-teal ${className}`} fill="none">
      <path d="M1 5c2.5-4 5-4 7.5 0s5 4 7.5 0 5-4 7.5 0 3 3 3.5 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function RoleChooser({ onChoose, onLogin }: RoleChooserProps) {
  const [hoveredRole, setHoveredRole] = useState<Role | null>(null)

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden bg-guaca-ocean-deep text-white sm:min-h-full">
      {/* The Caribbean from above, true geography: portrait crop on phones,
          landscape from md up. Both keep the open sea in the middle so the
          cards sit on calm water. */}
      <div className="absolute inset-0 bg-[url('/assets/join-caribbean-phone.webp')] bg-cover bg-center md:hidden" />
      <div className="absolute inset-0 hidden bg-[url('/assets/join-caribbean-wide.webp')] bg-cover bg-center md:block" />
      {/* Light enough that the painted foliage and the macaw at the bottom
          stay visible; the footer links sit on the darker band. */}
      <div className="absolute inset-0 bg-gradient-to-b from-guaca-sea/20 via-guaca-ocean/35 to-guaca-ocean-deep/60" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-guaca-ocean-deep/70" />

      {/* Palm frond corners */}
      <PalmFrondLeft className="pointer-events-none absolute left-[-10px] top-[-10px] h-44 w-32 opacity-80" />
      <PalmFrondRight className="pointer-events-none absolute right-[-10px] top-[-10px] h-44 w-32 opacity-80" />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-7 pt-16 sm:pt-20 md:max-w-3xl">
        {/* Brand hero */}
        <div className="flex flex-col items-center">
          <GuacaLogo variant="reversed" className="h-24 drop-shadow-[0_7px_18px_rgba(0,0,0,0.4)] md:h-28" />
          <p className="mt-2 text-[13px] font-semibold text-white/92 drop-shadow md:text-[14px]">
            Live map. Real info. Local rewards.
          </p>
          <Wave className="mt-3" />
        </div>

        {/* Choice: stacked glass cards on a phone; on a wider screen the two
            roles sit square, side by side, inside one glass panel with the
            business row beneath. */}
        <div className="mt-6 md:rounded-[28px] md:border md:border-white/14 md:bg-guaca-ocean-deep/35 md:p-6 md:shadow-2xl md:shadow-black/40 md:backdrop-blur-xl">
          <h1 className="mb-4 flex items-center justify-center gap-3 text-center text-[17px] font-extrabold tracking-[-.01em] text-white drop-shadow md:mb-5 md:text-[20px]">
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
                  className={`group flex w-full items-center gap-4 rounded-2xl border-2 bg-guaca-ocean-deep/55 p-4 text-left backdrop-blur-md transition-[transform,border-color,background-color] duration-150 ease-out hover:bg-guaca-ocean-deep/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:flex-col md:items-center md:gap-3 md:px-5 md:py-7 md:text-center ${role.tone.border} ${role.tone.borderHover} ${role.tone.glow} ${active ? '-translate-y-0.5' : ''}`}
                >
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_5px_rgba(255,255,255,0.14)] md:h-24 md:w-24 md:shadow-[0_0_0_7px_rgba(255,255,255,0.14)]">
                    <Icon aria-hidden="true" className={`h-8 w-8 md:h-11 md:w-11 ${role.tone.text}`} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[20px] font-extrabold leading-tight md:text-[22px] ${role.tone.text}`}>{role.title}</span>
                    <span className="mt-1 block text-[14px] font-semibold leading-snug text-white/92">{role.description}</span>
                    <span className={`mt-1.5 block text-[12px] font-semibold ${role.tone.text}`}>{role.helper}</span>
                  </span>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-[background-color,transform] duration-150 ${role.tone.border} ${role.tone.ringHover} ${active ? 'translate-x-0.5 md:translate-x-0 md:translate-y-0.5' : ''}`}>
                    <ArrowRight aria-hidden="true" className={`h-5 w-5 ${role.tone.text}`} />
                  </span>
                </button>
              )
            })}

            {/* Businesses are not an in-app role: this hands off to the site. */}
            <a
              href={BUSINESS_URL}
              className="group flex w-full items-center gap-4 rounded-2xl border-2 border-guaca-teal/45 bg-guaca-ocean-deep/55 p-4 text-left backdrop-blur-md transition-[transform,border-color,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-guaca-teal/80 hover:bg-guaca-ocean-deep/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:col-span-2 md:p-3.5"
            >
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_5px_rgba(255,255,255,0.14)] md:h-14 md:w-14">
                <Store aria-hidden="true" className="h-8 w-8 text-guaca-teal md:h-7 md:w-7" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[20px] font-extrabold leading-tight text-guaca-teal md:text-[16px]">
                  Business<span className="hidden md:inline"> access</span>
                </span>
                <span className="mt-1 block text-[14px] font-semibold leading-snug text-white/92 md:mt-0.5 md:text-[13px]">
                  <span className="md:hidden">Publish current local information</span>
                  <span className="hidden md:inline">Partner with Guaca to build stronger communities</span>
                </span>
                <span className="mt-1.5 block text-[12px] font-semibold text-guaca-teal md:hidden">Coverage gaps · live demand</span>
              </span>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-guaca-teal/60 transition-[background-color,transform] duration-150 group-hover:bg-guaca-teal/15 group-hover:translate-x-0.5">
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
          <div className="inline-flex items-center gap-2 rounded-full border border-guaca-teal/60 bg-guaca-ocean-deep/50 px-4 py-2 text-[12px] font-bold text-white/90 backdrop-blur-md">
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
    </div>
  )
}
