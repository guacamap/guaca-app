import { useMemo, useState } from 'react'
import { BadgeCheck, Bell, Clock3, MapPin, Megaphone, Mic, Search, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GuacaMap } from './GuacaMap'
import { GuacaMark } from './GuacaBrand'
import { formatUpdateTime, useInfoStore } from './InfoStore'

interface TouristViewProps {
  onRoleChange: () => void
}

export function TouristView({ onRoleChange }: TouristViewProps) {
  const { updates } = useInfoStore()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'map' | 'updates'>('map')
  const latestUpdate = updates[0]
  const filteredUpdates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return updates
    return updates.filter((update) =>
      [update.businessName, update.community, update.title, update.details, update.category]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [query, updates])

  const renderMap = () => (
    <>
      <div className="absolute inset-0 z-0">
        <GuacaMap
          pins={[]}
          mapStyle="satellite-streets"
          center={[-73.5, 18]}
          zoom={4.45}
          fallbackImage="/assets/landing-caribbean-phone.jpg"
        />
      </div>
      <div className="absolute inset-x-0 top-0 z-[400] bg-gradient-to-b from-guaca-ocean-deep/55 via-guaca-ocean/12 to-transparent px-4 pb-12 pt-8">
        <div className="flex items-center gap-2 rounded-full border border-white/65 bg-guaca-sand-light/95 px-3 py-2 shadow-xl shadow-guaca-ocean-deep/14 backdrop-blur-md">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-guaca-ocean/55" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') setActiveTab('updates') }}
            placeholder="Search current local updates"
            aria-label="Search current Caribbean information"
            className="h-7 flex-1 border-0 bg-transparent px-0 text-[12px] shadow-none placeholder:text-guaca-ink/35 focus-visible:ring-0"
          />
          <Button type="button" size="icon" variant="ghost" aria-label="Voice search coming later" className="h-10 w-10 rounded-full bg-guaca-teal/10 text-guaca-teal hover:bg-guaca-teal/15">
            <Mic aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Open business updates" onClick={() => setActiveTab('updates')} className="relative h-10 w-10 rounded-full bg-white/70 text-guaca-ocean hover:bg-white">
            <Bell aria-hidden="true" className="h-3.5 w-3.5" />
            {updates.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-guaca-coral ring-2 ring-white" />}
          </Button>
        </div>
      </div>

      <div className="absolute bottom-[82px] left-4 right-4 z-[400]">
        <div className="guaca-card rounded-[30px] p-4">
          {latestUpdate ? (
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guaca-teal/10 text-guaca-teal"><Store aria-hidden="true" className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black text-guaca-teal">{latestUpdate.businessName}{latestUpdate.community ? ` · ${latestUpdate.community}` : ''}</p>
                <h3 className="mt-1 text-[14px] font-black leading-snug text-guaca-ink">{latestUpdate.title}</h3>
                <p className={`mt-1 flex items-center gap-1 text-[10px] font-black ${latestUpdate.status === 'verified' ? 'text-emerald-700' : 'text-guaca-ink/45'}`}>
                  {latestUpdate.status === 'verified' ? <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />}
                  {latestUpdate.status === 'verified' ? 'Locally verified' : 'Published by the business'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-guaca-teal/10 text-guaca-teal"><MapPin aria-hidden="true" className="h-5 w-5" /></div>
              <div><h3 className="text-[14px] font-black text-guaca-ink">No local updates yet</h3><p className="mt-1 text-[11px] font-semibold leading-relaxed text-guaca-ink/52">Business information appears here as Caribbean communities join Guaca.</p></div>
            </div>
          )}
          <Button type="button" onClick={() => setActiveTab('updates')} className="mt-3 h-11 w-full rounded-2xl bg-guaca-teal text-xs font-black text-white hover:bg-guaca-teal-dark">
            <Megaphone aria-hidden="true" className="mr-1.5 h-4 w-4" /> View local updates
          </Button>
        </div>
      </div>
    </>
  )

  const renderUpdates = () => (
    <div className="h-full overflow-y-auto bg-guaca-sand-light px-5 pb-28 pt-14">
      <div className="rounded-[32px] bg-gradient-to-br from-guaca-teal to-guaca-ocean p-6 text-white shadow-xl shadow-guaca-teal/18">
        <GuacaMark className="h-12 w-auto" />
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em]">Local updates</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-white/88">Information published by Caribbean businesses, with local verification when a spotter has checked it.</p>
      </div>

      <div className="relative mt-5">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-guaca-teal" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search businesses, places, or updates" className="h-12 rounded-2xl border-guaca-sand bg-white pl-11 focus-visible:ring-guaca-teal" />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div><h2 className="text-[14px] font-black text-guaca-ink">Information for visitors</h2><p className="mt-1 text-[10px] font-semibold text-guaca-ink/45">Newest updates appear first.</p></div>
        {filteredUpdates.length > 0 && <span className="shrink-0 text-[10px] font-black text-guaca-teal">{filteredUpdates.length} found</span>}
      </div>

      {filteredUpdates.length === 0 ? (
        <div className="mt-4 rounded-[28px] border border-dashed border-guaca-teal/28 bg-white/60 p-6 text-center">
          <Store aria-hidden="true" className="mx-auto h-8 w-8 text-guaca-teal/55" />
          <h3 className="mt-4 text-[13px] font-black text-guaca-ink">{updates.length === 0 ? 'No business updates yet' : 'No updates match your search'}</h3>
          <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-semibold leading-relaxed text-guaca-ink/48">{updates.length === 0 ? 'When a business publishes current information, it will appear here.' : 'Try a different business, community, or topic.'}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredUpdates.map((update) => (
            <article key={update.id} className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-guaca-sand/75">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-guaca-teal/8 px-2.5 py-1 text-[9px] font-black text-guaca-teal">{update.category}</span>
                <span className={`flex items-center gap-1 text-[9px] font-black ${update.status === 'verified' ? 'text-emerald-700' : 'text-guaca-ink/42'}`}>
                  {update.status === 'verified' ? <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />}
                  {update.status === 'verified' ? `Verified by ${update.verifiedBy}` : 'Business-published'}
                </span>
              </div>
              <p className="mt-3 text-[10px] font-black text-guaca-teal-dark">{update.businessName}{update.community ? ` · ${update.community}` : ''}</p>
              <h3 className="mt-1 text-[14px] font-black leading-snug text-guaca-ink">{update.title}</h3>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-guaca-ink/60">{update.details}</p>
              <p className="mt-3 text-[9px] font-semibold text-guaca-ink/38">{formatUpdateTime(update.createdAt)}</p>
            </article>
          ))}
        </div>
      )}
      <Button type="button" variant="ghost" onClick={onRoleChange} className="mt-5 h-11 w-full rounded-2xl bg-guaca-teal/8 text-xs font-black text-guaca-teal hover:bg-guaca-teal/12">Switch role</Button>
    </div>
  )

  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-guaca-paper sm:min-h-full">
      {activeTab === 'map' ? renderMap() : renderUpdates()}
      <div className="absolute bottom-0 left-0 right-0 z-[500] border-t border-guaca-sand/70 bg-guaca-sand-light/96 px-12 pb-5 pt-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {[
            { id: 'map' as const, label: 'Map', icon: MapPin },
            { id: 'updates' as const, label: 'Updates', icon: Megaphone },
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
