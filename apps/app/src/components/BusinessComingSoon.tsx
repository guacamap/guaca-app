import { useState } from 'react'
import { ArrowRight, BadgeCheck, QrCode, Store } from 'lucide-react'
import { Button, GuacaLogo, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

/** Interest is captured on the waitlist form while the business product is
 *  still coming soon — the landing's #businesses section is informational. */
const WAITLIST_FORM_URL =
  process.env.NEXT_PUBLIC_WAITLIST_URL ??
  'https://docs.google.com/forms/d/e/1FAIpQLSf-y0xwBbCw77P6zTjgxqG6HaGVZCDmRQU-cTvpTB6kNf0_rg/viewform'

/**
 * The business surface is not built: publishing writes to localStorage with
 * no API or account behind it. Rather than ship a screen that pretends
 * otherwise, this wall states the plan honestly and sends interested owners
 * to the website, where a human onboards them (README rule: no self-signup
 * for businesses). The mock publisher stays reachable in dev only.
 */
export function BusinessComingSoon({ onPreview }: { onPreview?: () => void }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].business
  const [icons] = useState([BadgeCheck, Store, QrCode])

  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-guaca-ocean-deep px-6 pb-10 pt-14 text-white sm:h-full sm:min-h-full">
      <GuacaLogo variant="reversed" className="h-12" />

      <span className="mt-6 w-max rounded-full bg-guaca-mango px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-guaca-ocean-deep">
        {t.badge}
      </span>

      <h1 className="mt-4 text-3xl font-black leading-[1.06] tracking-[-.03em]">{t.title}</h1>
      <p className="mt-3 text-[13px] font-semibold leading-relaxed text-white/78">{t.lede}</p>

      <ul className="mt-7 space-y-3">
        {t.points.map((point, i) => {
          const Icon = icons[i] ?? BadgeCheck
          return (
            <li key={point} className="flex items-start gap-3 rounded-2xl bg-white/8 p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-guaca-mango/20 text-guaca-mango-light">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-semibold leading-relaxed text-white/85">{point}</span>
            </li>
          )
        })}
      </ul>

      <a
        href={WAITLIST_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 flex h-12 items-center justify-center gap-2 rounded-2xl bg-guaca-mango text-[13px] font-black text-guaca-ocean-deep hover:bg-guaca-mango-light"
      >
        {t.registerCta} <ArrowRight className="h-4 w-4" />
      </a>
      <p className="mt-2 text-center text-[10px] font-semibold text-white/50">{t.registerNote}</p>

      <div className="mt-auto pt-8">
        <Button
          type="button"
          variant="ghost"
          onClick={() => { window.location.href = '/' }}
          className="h-11 w-full rounded-2xl bg-white/10 text-xs font-black text-white hover:bg-white/20"
        >
          {t.backCta}
        </Button>
        {process.env.NODE_ENV !== 'production' && onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="mt-3 w-full py-2 text-[10px] font-bold text-white/40 underline-offset-2 hover:underline"
          >
            {t.devPreview}
          </button>
        )}
      </div>
    </div>
  )
}
