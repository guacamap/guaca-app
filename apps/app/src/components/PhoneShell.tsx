import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@guaca/ui'

/** The product frame: guaca-page backdrop + phone chrome on desktop. */
export function PhoneShell({
  children,
  showRoleSwitch = false,
}: {
  children: ReactNode
  showRoleSwitch?: boolean
}) {
  const router = useRouter()
  return (
    <div className="guaca-page">
      <div className="guaca-phone">
        <div className="guaca-screen">
          {children}
          {/* Top-right, below each screen's header band — bottom edges belong
              to cards, sheets and CTAs, which the pill must never cover. */}
          {showRoleSwitch && (
            <Button
              type="button"
              onClick={() => router.push('/')}
              className="absolute right-4 top-28 z-[600] h-10 rounded-full bg-guaca-ocean-deep/82 px-3 text-[11px] font-bold text-white shadow-xl shadow-guaca-ocean-deep/25 backdrop-blur-md hover:bg-guaca-ocean-deep"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Role
            </Button>
          )}
        </div>
        <div className="guaca-corner-mask" aria-hidden="true" />
      </div>
    </div>
  )
}
