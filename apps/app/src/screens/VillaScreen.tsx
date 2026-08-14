import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPinned } from 'lucide-react'
import { Button, GuacaLogo, useLanguage } from '@guaca/ui'
import { Providers } from '../components/Providers'
import { PhoneShell } from '../components/PhoneShell'
import { appCopy, saveAttribution } from '../lib/copy'

/** §4.1 — the villa QR landing: resolves the token to a property, stores
 *  the attribution (accounts created next inherit it), and opens the map. */
function VillaInner({ qrToken }: { qrToken: string }) {
  const router = useRouter()
  const { lang } = useLanguage()
  const t = appCopy[lang].villa
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; propertyName: string } | { kind: 'notFound' }
  >({ kind: 'loading' })

  useEffect(() => {
    fetch(`/api/v/${encodeURIComponent(qrToken)}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ language: lang }),
    })
      .then(async (r) => {
        if (!r.ok) return setState({ kind: 'notFound' })
        const s = (await r.json()) as {
          sessionId: string
          propertyId: string
          propertyName: string
        }
        saveAttribution({ qrToken, ...s })
        setState({ kind: 'ready', propertyName: s.propertyName })
      })
      .catch(() => setState({ kind: 'notFound' }))
  }, [qrToken, lang])

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <GuacaLogo className="h-14" />
      {state.kind === 'loading' && (
        <p className="text-sm font-bold text-guaca-ink/60">{t.connecting}</p>
      )}
      {state.kind === 'ready' && (
        <>
          <p className="text-xs font-black uppercase tracking-[.1em] text-guaca-teal">
            {t.welcomePrefix}
          </p>
          <p className="text-2xl font-black text-guaca-ocean-deep">{state.propertyName}</p>
          <Button
            type="button"
            onClick={() => router.push('/map')}
            className="h-12 rounded-xl bg-guaca-teal px-8 font-black text-white hover:bg-guaca-teal-dark"
          >
            <MapPinned className="mr-2 h-4 w-4" /> {t.continueCta}
          </Button>
        </>
      )}
      {state.kind === 'notFound' && (
        <>
          <p className="text-sm font-bold text-guaca-coral-dark">{t.notFound}</p>
          <Button
            type="button"
            onClick={() => router.push('/')}
            variant="outline"
            className="h-11 rounded-xl px-6 font-black"
          >
            {t.backHome}
          </Button>
        </>
      )}
    </div>
  )
}

export default function VillaScreen({ qrToken }: { qrToken: string }) {
  return (
    <Providers>
      <PhoneShell>
        <VillaInner qrToken={qrToken} />
      </PhoneShell>
    </Providers>
  )
}
