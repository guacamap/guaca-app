import { useState } from 'react'
import { BadgeCheck, Check, ClipboardCheck, Clock3, MapPin, Store } from 'lucide-react'
import { Button } from '@guaca/ui'
import { GuacaMap } from '@guaca/ui'
import { GuacaLogo } from '@guaca/ui'
import { formatUpdateTime, useInfoStore } from '@guaca/ui'

interface SpotterViewProps {
  onRoleChange: () => void
}

export function SpotterView({ onRoleChange }: SpotterViewProps) {
  const { updates, verifyUpdate } = useInfoStore()
  const [activeTab, setActiveTab] = useState<'map' | 'review'>('map')
  const waitingCount = updates.filter((update) => update.status === 'published').length

  const renderMap = () => (
    <>
      <div className="absolute inset-0 z-0">
        <GuacaMap pins={[]} mapStyle="satellite-streets" center={[-73.5, 18]} zoom={4.45} fallbackImage="/assets/landing-caribbean-phone.jpg" />
      </div>
      <div className="absolute inset-x-0 top-0 z-[400] bg-gradient-to-b from-guaca-ocean-deep/70 via-guaca-ocean/18 to-transparent px-4 pb-16 pt-8">
        <div className="flex items-center justify-between">
          <GuacaLogo variant="reversed" className="h-11 drop-shadow-lg" />
          <div className="rounded-2xl bg-white/90 px-3 py-2 text-[10px] font-black text-guaca-teal shadow-lg ring-1 ring-white/60">CARIBBEAN BETA</div>
        </div>
      </div>
      <div className="absolute bottom-[82px] left-4 right-4 z-[400]">
        <div className="guaca-card rounded-[30px] p-3">
          <div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guaca-coral/10 text-guaca-coral"><ClipboardCheck aria-hidden="true" className="h-6 w-6" /></div><div><p className="text-[14px] font-black text-guaca-ink">Local work starts with local information</p><p className="mt-1 text-[11px] font-semibold leading-relaxed text-guaca-ink/52">Review business updates only in communities you know.</p></div></div>
          <Button type="button" onClick={() => setActiveTab('review')} className="mt-3 h-12 w-full rounded-2xl bg-guaca-coral text-xs font-black text-white shadow-lg shadow-guaca-coral/24 hover:bg-guaca-coral-dark">
            <ClipboardCheck aria-hidden="true" className="mr-2 h-4 w-4" /> {waitingCount > 0 ? `Review ${waitingCount} update${waitingCount === 1 ? '' : 's'}` : 'Check review queue'}
          </Button>
        </div>
      </div>
    </>
  )

  const renderReview = () => (
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-28 pt-14">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-coral to-[#F24A37] p-6 text-white shadow-xl shadow-guaca-coral/18">
        <ClipboardCheck aria-hidden="true" className="h-12 w-12" />
        <h1 className="mt-4 text-[20px] font-black leading-tight">Review business updates</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/86">Verify only information you can personally confirm in the community.</p>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div><h2 className="text-[14px] font-black text-guaca-ink">Updates to review</h2><p className="mt-1 text-[10px] font-semibold text-guaca-ink/45">Business-published information appears here.</p></div>
        {waitingCount > 0 && <span className="shrink-0 rounded-full bg-guaca-coral/10 px-2.5 py-1 text-[9px] font-black text-guaca-coral-dark">{waitingCount} waiting</span>}
      </div>

      {updates.length === 0 ? (
        <div className="mt-4 rounded-[28px] border border-dashed border-guaca-coral/28 bg-white/60 p-6 text-center">
          <Store aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-coral/55" />
          <h3 className="mt-4 text-[13px] font-black text-guaca-ink">Nothing to review yet</h3>
          <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-semibold leading-relaxed text-guaca-ink/48">New information appears after a business publishes it.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3" aria-live="polite">
          {updates.map((update) => (
            <article key={update.id} className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-guaca-teal/8 px-2.5 py-1 text-[9px] font-black text-guaca-teal">{update.category}</span>
                <span className={`flex items-center gap-1 text-[9px] font-black ${update.status === 'verified' ? 'text-emerald-700' : 'text-guaca-ink/42'}`}>
                  {update.status === 'verified' ? <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />}
                  {update.status === 'verified' ? `Verified by ${update.verifiedBy}` : 'Needs verification'}
                </span>
              </div>
              <p className="mt-3 text-[10px] font-black text-guaca-teal-dark">{update.businessName}{update.community ? ` · ${update.community}` : ''}</p>
              <h3 className="mt-1 text-[14px] font-black leading-snug text-guaca-ink">{update.title}</h3>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-guaca-ink/60">{update.details}</p>
              <p className="mt-3 text-[9px] font-semibold text-guaca-ink/38">Published {formatUpdateTime(update.createdAt)}</p>
              {update.status === 'published' ? (
                <Button type="button" onClick={() => verifyUpdate(update.id, 'Local spotter')} className="mt-4 h-11 w-full rounded-2xl bg-guaca-teal text-[12px] font-black text-white shadow-md shadow-guaca-teal/15 hover:bg-guaca-teal-dark"><BadgeCheck aria-hidden="true" className="mr-2 h-4 w-4" />Verify this information</Button>
              ) : (
                <div className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 text-[11px] font-black text-emerald-800"><Check aria-hidden="true" className="h-4 w-4" />Verification recorded</div>
              )}
            </article>
          ))}
        </div>
      )}
      <Button type="button" variant="ghost" onClick={onRoleChange} className="mt-5 h-11 w-full rounded-2xl bg-guaca-teal/8 text-xs font-black text-guaca-teal hover:bg-guaca-teal/12">Switch role</Button>
    </div>
  )

  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-guaca-paper sm:min-h-full">
      {activeTab === 'map' ? renderMap() : renderReview()}
      <div className="absolute bottom-0 left-0 right-0 z-[500] border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-12 pb-5 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {[
            { id: 'map' as const, label: 'Map', icon: MapPin },
            { id: 'review' as const, label: 'Review', icon: ClipboardCheck },
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return <Button key={tab.id} type="button" variant="ghost" onClick={() => setActiveTab(tab.id)} aria-label={tab.label} aria-current={active ? 'page' : undefined} className={`h-14 min-w-24 flex-col gap-1 rounded-2xl px-4 text-[10px] font-bold hover:bg-transparent ${active ? 'text-guaca-teal' : 'text-guaca-ink/42'}`}><Icon className={`h-5 w-5 ${active ? 'fill-guaca-teal/10' : ''}`} />{tab.label}</Button>
          })}
        </div>
      </div>
    </div>
  )
}
