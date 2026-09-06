import type { ReactNode } from 'react'
import { GuacaLogo, useLanguage } from '@guaca/ui'

/**
 * The scene every entry screen shares: the Caribbean from above, true
 * geography, portrait crop on phones and landscape from md up, with the
 * open sea in the middle so whatever sits there sits on calm water. The
 * overlays are light enough that the painted foliage and the macaw at the
 * bottom stay visible; the darker band at the bottom carries footer text.
 */
export function JoinScene({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`join-scene relative flex h-full min-h-0 flex-col overflow-y-auto bg-guaca-ocean-deep text-white ${className}`}>
      <div className="absolute inset-0 bg-[url('/assets/join-caribbean-phone.webp')] bg-cover bg-center md:hidden" />
      <div className="absolute inset-0 hidden bg-[url('/assets/join-caribbean-wide.webp')] bg-cover bg-center md:block" />
      <div className="absolute inset-0 bg-guaca-ocean-deep/65" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-guaca-ocean-deep/70" />
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  )
}

/** The wordmark and tagline that open every entry screen. */
export function JoinBrand({ compact = false }: { compact?: boolean }) {
  const { lang } = useLanguage()
  return (
    <div className="flex flex-col items-center">
      <GuacaLogo variant="reversed" className={`${compact ? 'h-20' : 'h-24'} drop-shadow-[0_7px_18px_rgba(0,0,0,0.4)]`} />
      <p className="mt-2 text-[13px] font-semibold text-white/92 drop-shadow md:text-[14px]">
        {lang === 'es' ? 'El Caribe, con conocimiento local.' : 'The Caribbean, with local knowledge.'}
      </p>
    </div>
  )
}

/** The little "~~~" ornament. */
export function Wave({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 8" className={`h-2 w-7 text-guaca-teal ${className}`} fill="none">
      <path d="M1 5c2.5-4 5-4 7.5 0s5 4 7.5 0 5-4 7.5 0 3 3 3.5 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Frosted glass in a role's colour, the same glass the join cards use. */
export const GLASS = {
  teal: {
    card: 'border-white/15',
    text: 'text-guaca-teal-light',
    button: 'bg-guaca-teal hover:bg-guaca-teal-dark',
    ring: 'focus-visible:ring-guaca-teal/70',
  },
  coral: {
    card: 'border-white/15',
    text: 'text-guaca-coral-light',
    button: 'bg-guaca-coral hover:bg-guaca-coral-dark',
    ring: 'focus-visible:ring-guaca-coral/70',
  },
} as const
export type GlassTone = keyof typeof GLASS

/** Dark-glass text field classes, applied over the shared Input. */
export const GLASS_INPUT =
  'h-12 rounded-xl border-white/35 bg-white/10 px-4 text-base font-medium text-white placeholder:text-white/70 focus-visible:ring-2 focus-visible:ring-offset-0'
