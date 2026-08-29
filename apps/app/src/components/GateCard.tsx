import type { ComponentType, ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import { GLASS, JoinBrand, JoinScene, type GlassTone } from './JoinScene'

/**
 * The sign-in card both gates render: the scene, the brand, one frosted
 * card in the role's colour with the role's icon on a white disc, and a
 * way back to the role choice.
 */
export function GateCard({
  tone,
  icon: Icon,
  title,
  lede,
  error,
  children,
}: {
  tone: GlassTone
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>
  title: string
  lede: string
  error?: string | null
  children: ReactNode
}) {
  const { lang } = useLanguage()
  const g = GLASS[tone]
  return (
    <JoinScene>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-16 sm:pt-20 md:justify-center md:pt-10">
        <JoinBrand compact />
        <section
          aria-labelledby="gate-title"
          className={`mt-6 rounded-[22px] border-[1.5px] bg-[rgba(40,110,130,0.26)] p-5 backdrop-blur-lg md:p-7 ${g.card}`}
        >
          <div className="flex items-center gap-4">
            <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18),0_0_0_7px_rgba(255,255,255,0.06)]">
              <Icon aria-hidden="true" className={`h-7 w-7 ${g.text}`} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h1 id="gate-title" className={`text-[21px] font-extrabold leading-tight ${g.text}`}>{title}</h1>
            </div>
          </div>
          <p className="mt-3 text-[13.5px] font-medium leading-6 text-white/85">{lede}</p>
          {children}
          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-guaca-coral/60 bg-guaca-coral/20 px-3 py-2 text-[12.5px] font-bold text-white">
              {error}
            </p>
          )}
        </section>
        <a
          href="/"
          className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded text-[13px] font-bold text-white/80 underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          {lang === 'es' ? 'Elegir otro rol' : 'Choose another role'}
        </a>
      </div>
    </JoinScene>
  )
}
