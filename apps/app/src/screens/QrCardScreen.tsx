import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { Button, GuacaLogo } from '@guaca/ui'

/**
 * T7.7 — the print-ready villa card. Physical artifact for guest rooms:
 * both languages ON the card (paper has no language toggle). The QR encodes
 * the villa landing; NEXT_PUBLIC_QR_BASE_URL pins the printed URL to prod
 * regardless of where the operator opens this page.
 */
export default function QrCardScreen({ qrToken }: { qrToken: string }) {
  const [propertyName, setPropertyName] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const base = process.env.NEXT_PUBLIC_QR_BASE_URL ?? 'https://app.guaca.live'
  const url = `${base}/v/${qrToken}`

  useEffect(() => {
    fetch(`/api/v/${encodeURIComponent(qrToken)}/info`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('404'))))
      .then((d: { propertyName: string }) => setPropertyName(d.propertyName))
      .catch(() => setNotFound(true))
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#0A2F3C', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setNotFound(true))
  }, [qrToken, url])

  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-guaca-paper p-8">
        <p className="text-sm font-black text-guaca-coral-dark">QR not found · QR no encontrado</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-guaca-paper p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-[420px]">
        <Button
          type="button"
          onClick={() => window.print()}
          className="mb-5 h-11 w-full rounded-xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark print:hidden"
        >
          <Printer aria-hidden="true" className="mr-2 h-4 w-4" /> Imprimir · Print
        </Button>

        <div className="overflow-hidden rounded-[28px] border-2 border-guaca-teal/20 bg-white shadow-xl print:rounded-none print:border-guaca-teal/40 print:shadow-none">
          <div className="bg-gradient-to-br from-guaca-teal to-guaca-ocean px-7 py-6 text-center text-white">
            <GuacaLogo variant="reversed" className="mx-auto h-12" />
            <p className="mt-3 text-[13px] font-black tracking-tight">
              El Caribe, en tiempo real.
            </p>
          </div>

          <div className="px-7 py-6 text-center">
            {propertyName && (
              <>
                <p className="text-[10px] font-black uppercase tracking-[.12em] text-guaca-teal">
                  Huésped de · Guest of
                </p>
                <h1 className="mt-1 text-xl font-black tracking-tight text-guaca-ocean-deep">
                  {propertyName}
                </h1>
              </>
            )}

            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR — ${url}`}
                className="mx-auto mt-5 w-56 rounded-2xl ring-1 ring-guaca-sand"
              />
            )}

            <div className="mt-5 space-y-2 text-[12px] font-bold leading-5 text-guaca-ink/75">
              <p>
                📱 Escanea para descubrir lugares <span className="text-guaca-teal">verificados por locales</span> cerca de ti.
              </p>
              <p className="text-guaca-ink/55">
                Scan to discover places <span className="text-guaca-teal">verified by locals</span> near you.
              </p>
            </div>

            <p className="mt-5 border-t border-guaca-sand pt-3 text-[10px] font-black text-guaca-ink/40">
              {url.replace('https://', '')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
