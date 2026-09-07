import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, BadgeCheck, BedDouble, ChevronDown, ChevronUp, Compass, Globe, Heart, Landmark, Leaf, MapPin, Music2, Search, ShoppingBag, Utensils, Waves, Wrench, X } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import type { PublicPlaceProfile } from '@guaca/shared'
import { appCopy } from '../lib/copy'

export type DiscoveryMode = 'places' | 'activities' | 'stays'

export interface DiscoveryPlace {
  id: string
  name: string
  category: string
  lat: number
  lon: number
  verification_status?: string
  corroboration?: number
  public_subcategory?: string | null
  public_profile?: PublicPlaceProfile | null
  spotter_name?: string | null
  trendBadge?: 'trending' | 'asked_about' | 'fresh' | null
}

export const PLACE_ICONS: Record<string, typeof MapPin> = {
  eat_drink: Utensils, beach_water: Waves, nature_walk: Leaf,
  culture_history: Landmark, market_shop: ShoppingBag, nightlife_music: Music2,
  services: Wrench, practical: Compass, lodging: BedDouble,
}

export function PlaceDiscovery({ places, areaName, center, categories, loading, error, onRetry, onSelect, savedIds, onSave, context, hiddenOnMobile, mode = 'places', onModeChange, activitiesPanel, staysPanel }: {
  places: DiscoveryPlace[]
  areaName: string
  center: [number, number]
  categories: Record<string, string>
  loading: boolean
  error: boolean
  onRetry: () => void
  onSelect: (id: string) => void
  savedIds: Set<string>
  onSave: (place: DiscoveryPlace) => void
  context: string | null
  hiddenOnMobile: boolean
  mode?: DiscoveryMode
  onModeChange?: (mode: DiscoveryMode) => void
  activitiesPanel?: ReactNode
  staysPanel?: ReactNode
}) {
  const { lang } = useLanguage()
  const es = lang === 'es'
  const copy = appCopy[lang].tourist
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (mode !== 'places') setExpanded(true)
  }, [mode])
  const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const results = useMemo(() => places
    .filter((p) => normalized(`${p.name} ${p.public_subcategory ?? ''} ${categories[p.category] ?? ''}`).includes(normalized(search.trim())))
    .map((p) => ({ ...p, km: Math.hypot((p.lat - center[1]) * 111.32, (p.lon - center[0]) * 111.32 * Math.cos(center[1] * Math.PI / 180)) }))
    .sort((a, b) => Number(b.verification_status === 'verified') - Number(a.verification_status === 'verified')
      || (b.corroboration ?? 0) - (a.corroboration ?? 0)
      || Number(Boolean(b.public_profile)) - Number(Boolean(a.public_profile))
      || a.km - b.km), [places, center, search, categories])

  return (
    <aside className={`discovery-panel ${expanded ? 'is-expanded' : ''} ${hiddenOnMobile ? 'mobile-hidden' : ''}`} aria-label={es ? 'Explorar lugares' : 'Explore places'}>
      <div className="discovery-heading">
        <div>
          <h1>{areaName}</h1>
          <p>{es ? 'Un lugar para empezar a explorar.' : 'Somewhere good to start exploring.'}</p>
        </div>
        <button type="button" className="discovery-expand" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="discovery-content" aria-label={expanded ? (es ? 'Ver el mapa' : 'Show map') : (es ? 'Explorar lugares' : 'Browse places')}>
          <span>{expanded ? (es ? 'Mapa' : 'Map') : (es ? 'Explorar' : 'Browse')}</span>
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>
      {context && <p className="discovery-context">{context}</p>}
      <div id="discovery-content" className="discovery-content">
      {onModeChange && (
        <div className="discovery-modes" role="tablist" aria-label={es ? 'Explorar' : 'Explore'}>
          {([
            ['places', copy.discoverPlaces],
            ['activities', copy.discoverActivities],
            ['stays', copy.discoverStays],
          ] as Array<[DiscoveryMode, string]>).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => onModeChange(id)}>
              {label}
            </button>
          ))}
        </div>
      )}
        {mode === 'activities' && activitiesPanel}
        {mode === 'stays' && staysPanel}
        {mode === 'places' && <>
        <label className="discovery-search">
          <Search size={17} aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={es ? 'Buscar un lugar…' : 'Find a place…'} aria-label={es ? 'Buscar lugares' : 'Search places'} />
          {search && <button type="button" onClick={() => setSearch('')} aria-label={es ? 'Borrar búsqueda' : 'Clear search'}><X size={16} /></button>}
        </label>
        <div className="discovery-count" aria-live="polite">
          <span>{loading ? (es ? 'Buscando lugares…' : 'Finding places…') : `${results.length} ${es ? (results.length === 1 ? 'lugar para explorar' : 'lugares para explorar') : (results.length === 1 ? 'place to explore' : 'places to explore')}`}</span>
          <span><span className="discovery-dot" /> {es ? 'Fuentes indicadas' : 'Sources shown'}</span>
        </div>
        <div className="discovery-list" aria-busy={loading}>
          {loading && !places.length && <div className="discovery-loading" role="status">{es ? 'Cargando el mapa local…' : 'Loading the local map…'}</div>}
          {error && <div className="discovery-empty" role="alert"><p>{es ? 'No pudimos cargar los lugares.' : 'We couldn’t load the places.'}</p><button onClick={onRetry}>{es ? 'Intentar de nuevo' : 'Try again'} <ArrowRight size={16} /></button></div>}
          {!loading && !error && results.length === 0 && <div className="discovery-empty"><Compass size={28} /><h2>{es ? 'Todavía hay más por descubrir' : 'There’s more to discover'}</h2><p>{search ? (es ? 'Prueba otro nombre o categoría.' : 'Try another name or category.') : (es ? 'Prueba otra categoría o pregúntale a Guaca.' : 'Try another category, or ask Guaca.')}</p>{search && <button type="button" onClick={() => setSearch('')}>{es ? 'Borrar búsqueda' : 'Clear search'} <ArrowRight size={16} /></button>}</div>}
          {results.slice(0, 80).map((p) => {
            const Icon = PLACE_ICONS[p.category] ?? MapPin
            const verified = p.verification_status === 'verified'
            const saved = savedIds.has(p.id)
            const tier = verified ? (p.spotter_name ? `${es ? 'Verificado por' : 'Verified by'} ${p.spotter_name}` : (es ? 'Verificado en persona' : 'Verified in person'))
              : (p.corroboration ?? 0) >= 2 ? `${p.corroboration} ${es ? 'mapas coinciden' : 'maps agree'}`
              : (es ? 'Listado · sin confirmar' : 'Listed · unconfirmed')
            return <div className="discovery-row" key={p.id}>
              <button className="discovery-place" type="button" onClick={() => onSelect(p.id)}>
                {p.public_profile?.image && !failedImages.has(p.id)
                  ? <img className="discovery-thumbnail" src={p.public_profile.image.url} alt="" width={64} height={72} loading="lazy" onError={() => setFailedImages((previous) => new Set([...previous, p.id]))} />
                  : <span className={`discovery-category category-${p.category}`}><Icon size={22} aria-hidden="true" /></span>}
                <span className="discovery-place-copy"><strong>{p.name}</strong><span>{categories[p.category] ?? p.category} <span aria-hidden="true">·</span> {p.km < 1 ? `${Math.round(p.km * 1000)} m` : `${p.km.toFixed(1)} km`}</span><small className={verified ? 'is-verified' : ''}>{verified ? <BadgeCheck size={13} /> : <Globe size={13} />}{tier}</small>{p.trendBadge === 'trending' && <small className="is-verified">{es ? 'En tendencia' : 'Trending'}</small>}</span>
              </button>
              <button type="button" className={`discovery-save ${saved ? 'is-saved' : ''}`} aria-label={`${saved ? (es ? 'Quitar' : 'Unsave') : (es ? 'Guardar' : 'Save')} ${p.name}`} aria-pressed={saved} onClick={() => onSave(p)}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
            </div>
          })}
        </div>
        <p className="discovery-footnote"><Globe size={15} aria-hidden="true" />{es ? 'Los datos públicos orientan. Una visita local los confirma.' : 'Public data is a starting point. A local visit confirms it.'}</p>
        </>}
      </div>
    </aside>
  )
}
