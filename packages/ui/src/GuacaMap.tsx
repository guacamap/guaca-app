import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '').trim()

if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN

interface MapPin {
  id: string
  lat: number
  lng: number
  emoji: string
  iconSvg?: string
  label: string
  spotterColor: string
  spotterInitials: string
  verified: boolean
  /** e.g. "4.5" — shown as a small ★ badge when review activity exists. */
  ratingBadge?: string
  /** Trend-engine badge — shown as a small 🔥 mark on the pin. */
  trendBadge?: string | null
}

interface GapPin {
  id: string
  lat: number
  lng: number
  label: string
  asks: number
  category: string
}

/**
 * A country-level coverage marker — an honest claim, not a place pin.
 * Shown only when the map is zoomed out (zoom ≤ 5.5); zooming in hands
 * the canvas back to verified pins and unverified candidate dots.
 */
export interface CountryMarker {
  code: string
  label: string
  status: 'live' | 'planned' | 'uncovered'
  statusLabel: string
  lat: number
  lng: number
}

/**
 * A tappable zone marker — the area picker, directly on the map. Visible
 * in the mid-zoom band (5.5 < zoom ≤ 9): countries at low zoom hand over
 * to their zones as you zoom in, so a person can go basin → country →
 * zone without ever opening the menu.
 */
export interface ZoneMarker {
  id: string
  label: string
  lat: number
  lng: number
  selected?: boolean
}

/** Unverified candidates (OSM import) — rendered as a GPU circle layer,
 *  never as DOM markers: there can be hundreds. */
interface MapDot {
  id: string
  lat: number
  lng: number
  label: string
  category: string
}

/** Review-activity heat: weight = posts/reviews at that spot. */
interface HeatPoint {
  lat: number
  lng: number
  weight: number
}

export const MAP_STYLES = [
  { id: 'satellite-streets', label: 'Satellite', style: 'mapbox://styles/mapbox/satellite-streets-v12', icon: 'satellite' },
  { id: 'streets', label: 'Streets', style: 'mapbox://styles/mapbox/streets-v12', icon: 'road' },
  { id: 'outdoors', label: 'Outdoors', style: 'mapbox://styles/mapbox/outdoors-v12', icon: 'mountain' },
  { id: 'light', label: 'Light', style: 'mapbox://styles/mapbox/light-v11', icon: 'sun' },
  { id: 'dark', label: 'Dark', style: 'mapbox://styles/mapbox/dark-v11', icon: 'moon' },
] as const

export type MapStyleId = typeof MAP_STYLES[number]['id']

interface GuacaMapProps {
  pins: MapPin[]
  gapPins?: GapPin[]
  dots?: MapDot[]
  heat?: HeatPoint[]
  countries?: CountryMarker[]
  zones?: ZoneMarker[]
  onZoneSelect?: (id: string) => void
  onCountrySelect?: (code: string) => void
  /** Selected-area outline — the city/area the user picked. */
  areaHighlight?: AreaHighlight | null
  /** Imperative fly-to; fires when `nonce` changes. */
  flyTo?: { lat: number; lng: number; zoom?: number; nonce: number }
  selectedPinId?: string | null
  selectedGapId?: string | null
  onPinClick?: (id: string) => void
  onGapClick?: (id: string) => void
  onDotClick?: (id: string) => void
  /** Blue current-location marker with live tracking (GeolocateControl). */
  showUserLocation?: boolean
  mapStyle?: MapStyleId
  center?: [number, number]
  zoom?: number
  className?: string
  style?: React.CSSProperties
  fallbackImage?: string
}

const DOTS_SOURCE = 'guaca-dots'
const HEAT_SOURCE = 'guaca-heat'

/** mapbox-gl's own GeoJSON input type — avoids a @types/geojson dependency. */
type GeoJsonData = Parameters<mapboxgl.GeoJSONSource['setData']>[0]

function dotsGeoJson(dots: MapDot[]): GeoJsonData {
  return {
    type: 'FeatureCollection',
    features: dots.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: { id: d.id, label: d.label, category: d.category },
    })),
  } as GeoJsonData
}

function heatGeoJson(points: HeatPoint[]): GeoJsonData {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { weight: p.weight },
    })),
  } as GeoJsonData
}

/** (Re)installs the dots + heat sources/layers; safe after style swaps. */
/** Bounding box of the selected area, drawn as an outline + soft fill. */
export interface AreaHighlight {
  /** [lonMin, latMin, lonMax, latMax] */
  bbox: [number, number, number, number]
  label?: string
}

const AREA_SOURCE = 'guaca-area'

function areaGeoJson(h: AreaHighlight): { type: "FeatureCollection"; features: unknown[] } {
  const [lonMin, latMin, lonMax, latMax] = h.bbox
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lonMin, latMin], [lonMax, latMin], [lonMax, latMax],
            [lonMin, latMax], [lonMin, latMin],
          ]],
        },
      },
    ],
  }
}

function installDataLayers(map: mapboxgl.Map, dots: MapDot[], heat: HeatPoint[], area?: AreaHighlight | null) {
  if (!map.getSource(HEAT_SOURCE)) {
    map.addSource(HEAT_SOURCE, { type: 'geojson', data: heatGeoJson(heat) })
    map.addLayer({
      id: `${HEAT_SOURCE}-layer`,
      type: 'heatmap',
      source: HEAT_SOURCE,
      paint: {
        'heatmap-weight': ['coalesce', ['get', 'weight'], 0],
        'heatmap-intensity': 0.8,
        'heatmap-radius': 42,
        'heatmap-opacity': 0.45,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(13,139,139,0)',
          0.3, 'rgba(13,139,139,0.35)',
          0.6, 'rgba(212,168,83,0.5)',
          1, 'rgba(232,115,90,0.65)',
        ],
      },
    })
  } else {
    ;(map.getSource(HEAT_SOURCE) as mapboxgl.GeoJSONSource).setData(heatGeoJson(heat))
  }
  if (!map.getSource(DOTS_SOURCE)) {
    map.addSource(DOTS_SOURCE, { type: 'geojson', data: dotsGeoJson(dots) })
    map.addLayer({
      id: `${DOTS_SOURCE}-layer`,
      type: 'circle',
      source: DOTS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5],
        'circle-color': '#0C4A5C',
        'circle-opacity': 0.55,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.7,
      },
    })
  } else {
    ;(map.getSource(DOTS_SOURCE) as mapboxgl.GeoJSONSource).setData(dotsGeoJson(dots))
  }
  if (area) {
    if (!map.getSource(AREA_SOURCE)) {
      map.addSource(AREA_SOURCE, { type: 'geojson', data: areaGeoJson(area) })
      // Soft fill + crisp outline — the selected area reads at any zoom,
      // under markers and above the basemap.
      map.addLayer({
        id: `${AREA_SOURCE}-fill`,
        type: 'fill',
        source: AREA_SOURCE,
        paint: { 'fill-color': '#0D7A72', 'fill-opacity': 0.07 },
      })
      map.addLayer({
        id: `${AREA_SOURCE}-outline`,
        type: 'line',
        source: AREA_SOURCE,
        paint: { 'line-color': '#0D7A72', 'line-width': 2, 'line-dasharray': [2, 1.5] },
      })
    } else {
      ;(map.getSource(AREA_SOURCE) as mapboxgl.GeoJSONSource).setData(areaGeoJson(area))
    }
  } else if (map.getSource(AREA_SOURCE)) {
    ;(map.getSource(AREA_SOURCE) as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] })
  }
}

function createPinHTML(_emoji: string, iconSvg: string | undefined, color: string, verified: boolean, isSelected: boolean, ratingBadge?: string, trendBadge?: string | null) {
  const size = isSelected ? 46 : 40
  const border = isSelected ? '3px solid #D97E00' : '2.5px solid #fff'
  const iconContent = iconSvg
    ? `<span style="display:flex;align-items:center;justify-content:center">${iconSvg}</span>`
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.8 7-11.3a7 7 0 1 0-14 0C5 15.2 12 21 12 21Z"/><circle cx="12" cy="9.7" r="2.4"/></svg>'
  return `
    <div class="guaca-map-marker" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      width: ${size}px;
      cursor: pointer;
      transition: transform 0.15s ease;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
    ">
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? 20 : 17}px;
        border: ${border};
        box-sizing: border-box;
      ">${iconContent}</div>
      ${ratingBadge ? `
      <div style="
        position: absolute;
        top: -7px;
        left: -9px;
        background: #D97E00;
        color: white;
        font-size: 8.5px;
        font-weight: 800;
        padding: 1px 5px;
        border-radius: 8px;
        white-space: nowrap;
        border: 1.5px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      ">★ ${ratingBadge}</div>` : ''}
      ${trendBadge ? `
      <div style="
        position: absolute;
        top: -7px;
        right: -9px;
        background: #E8735A;
        color: white;
        font-size: 9px;
        font-weight: 800;
        padding: 1px 5px;
        border-radius: 8px;
        white-space: nowrap;
        border: 1.5px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      ">${trendBadge === 'trending' ? '🔥' : trendBadge === 'asked_about' ? '❓' : '✨'}</div>` : ''}
      ${verified ? `
      <div style="
        position: absolute;
        bottom: -1px;
        right: -1px;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #22c55e;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      ">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>` : ''}
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid ${color};
        margin-top: -2px;
      "></div>
    </div>
  `
}

function createGapPinHTML(asks: number, isSelected: boolean) {
  const size = isSelected ? 42 : 36
  return `<div class="guaca-map-marker" style="display:flex;flex-direction:column;align-items:center;width:${size}px;cursor:pointer"><div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(232,115,90,0.9);display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-sizing:border-box;box-shadow:0 0 0 4px rgba(232,115,90,0.25),0 2px 8px rgba(0,0,0,0.3);animation:gapPulse 2s ease-in-out infinite"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div><div style="position:absolute;top:-8px;right:-8px;background:#E8735A;color:white;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2)">${asks}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid rgba(232,115,90,0.9);margin-top:-2px"></div></div>`
}

/**
 * Co-located pins rendered on top of each other leave only the upper one
 * tappable. Fan duplicates within ~11m out on a deterministic golden-angle
 * spiral (~13m rings): invisible at city zoom, honest at street zoom, and
 * stable across re-renders because it depends only on input order.
 */
function deCollide<T extends { id: string; lat: number; lng: number }>(
  items: readonly T[],
): Map<string, [number, number]> {
  const seen = new Map<string, number>()
  const out = new Map<string, [number, number]>()
  for (const p of items) {
    const key = `${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`
    const i = seen.get(key) ?? 0
    seen.set(key, i + 1)
    if (i === 0) {
      out.set(p.id, [p.lng, p.lat])
      continue
    }
    const angle = i * 2.399963 // golden angle
    const r = 0.00012 * Math.sqrt(i)
    out.set(p.id, [p.lng + r * Math.cos(angle), p.lat + r * Math.sin(angle)])
  }
  return out
}

function makeMarkerInteractive(el: HTMLElement, label: string, activate?: () => void) {
  el.tabIndex = 0
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', label)
  el.addEventListener('click', (event) => {
    event.stopPropagation()
    activate?.()
  })
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    activate?.()
  })
}

function createTreasureHTML() {
  return `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 48px;
      cursor: pointer;
      filter: drop-shadow(0 0 16px rgba(217,126,0,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    ">
      <div style="
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(180deg, #fbbf24, #d97706);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(251,191,36,0.6);
        box-sizing: border-box;
      "><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v.01"/><path d="M2 12h20"/></svg></div>
    </div>
  `
}

export function GuacaMap({
  pins,
  gapPins,
  dots,
  heat,
  countries,
  zones,
  onZoneSelect,
  onCountrySelect,
  areaHighlight,
  flyTo,
  selectedPinId,
  selectedGapId,
  onPinClick,
  onGapClick,
  onDotClick,
  showUserLocation = false,
  mapStyle = 'satellite-streets',
  center = [-68.0075, 10.4665],
  zoom = 15,
  className,
  style,
  fallbackImage,
}: GuacaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  // De-collided pin positions — recomputed whenever the pin set changes.
  const pinPositions = useMemo(() => deCollide(pins), [pins])
  const dotsRef = useRef<MapDot[]>(dots ?? [])
  const areaHighlightRef = useRef<AreaHighlight | null | undefined>(areaHighlight)
  const heatRef = useRef<HeatPoint[]>(heat ?? [])
  const onDotClickRef = useRef(onDotClick)
  dotsRef.current = dots ?? []
  areaHighlightRef.current = areaHighlight
  heatRef.current = heat ?? []
  onDotClickRef.current = onDotClick

  const styleUrl = MAP_STYLES.find(s => s.id === mapStyle)?.style || MAP_STYLES[0].style

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      pitch: 0,
      bearing: 0,
      projection: 'mercator',
      attributionControl: true,
      maxZoom: 19,
      // The Caribbean is the product: the map must zoom out to the whole
      // basin (and past it) — country coverage markers live at low zoom.
      minZoom: 2.5,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

    let geolocate: mapboxgl.GeolocateControl | null = null
    if (showUserLocation) {
      geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      })
      map.addControl(geolocate, 'bottom-right')
    }

    map.on('load', () => {
      if (geolocate) geolocate.trigger()
      // Slightly reduce label opacity for readability
      const layers = map.getStyle().layers
      if (layers) {
        for (const layer of layers) {
          if (layer.type === 'symbol' && layer.layout) {
            map.setLayerProperty(layer.id, 'text-opacity', 0.7)
          }
        }
      }
      installDataLayers(map, dotsRef.current, heatRef.current, areaHighlightRef.current)
    })

    map.on('click', `${DOTS_SOURCE}-layer`, (e) => {
      const feature = e.features?.[0] as { properties?: { id?: string } } | undefined
      const id = feature?.properties?.id
      if (id) onDotClickRef.current?.(id)
    })
    map.on('mouseenter', `${DOTS_SOURCE}-layer`, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', `${DOTS_SOURCE}-layer`, () => {
      map.getCanvas().style.cursor = ''
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Swap map style when user selects a different one (skip initial mount)
  const initialStyleRef = useRef(styleUrl)
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleUrl === initialStyleRef.current) return
    map.setStyle(styleUrl)
    map.once('style.load', () => {
      // Re-add all markers and data layers after style swap clears them
      installDataLayers(map, dotsRef.current, heatRef.current, areaHighlightRef.current)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()

      pins.forEach((pin) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = createPinHTML(pin.emoji, pin.iconSvg, pin.spotterColor, pin.verified, pin.id === selectedPinId, pin.ratingBadge, pin.trendBadge)
        const el = wrapper.firstElementChild as HTMLElement
        if (!el) return
        makeMarkerInteractive(el, pin.label, () => onPinClick?.(pin.id))
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(pinPositions.get(pin.id) ?? [pin.lng, pin.lat])
          .addTo(map)
        markersRef.current.set(pin.id, marker)
      })

      if (gapPins) {
        gapPins.forEach((gap) => {
          const wrapper = document.createElement('div')
          wrapper.innerHTML = createGapPinHTML(gap.asks, gap.id === selectedGapId)
          const el = wrapper.firstElementChild as HTMLElement
          if (!el) return
          makeMarkerInteractive(el, `${gap.label}, requested ${gap.asks} times`, () => onGapClick?.(gap.id))
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([gap.lng, gap.lat])
            .addTo(map)
          markersRef.current.set(gap.id, marker)
        })
      }
    })
  }, [styleUrl])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    pins.forEach((pin) => {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = createPinHTML(pin.emoji, pin.iconSvg, pin.spotterColor, pin.verified, pin.id === selectedPinId, pin.ratingBadge, pin.trendBadge)
      const el = wrapper.firstElementChild as HTMLElement
      if (!el) return

      makeMarkerInteractive(el, pin.label, () => onPinClick?.(pin.id))

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(pinPositions.get(pin.id) ?? [pin.lng, pin.lat])
        .addTo(map)

      markersRef.current.set(pin.id, marker)
    })

    // Add gap markers
    if (gapPins) {
      gapPins.forEach((gap) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = createGapPinHTML(gap.asks, gap.id === selectedGapId)
        const el = wrapper.firstElementChild as HTMLElement
        if (!el) return

        makeMarkerInteractive(el, `${gap.label}, requested ${gap.asks} times`, () => onGapClick?.(gap.id))

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([gap.lng, gap.lat])
          .addTo(map)

        markersRef.current.set(gap.id, marker)
      })
    }
  }, [pins, gapPins, selectedPinId, selectedGapId, onPinClick, onGapClick])

  // Keep data layers in sync
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    installDataLayers(map, dots ?? [], heat ?? [], areaHighlight)
  }, [dots, heat, areaHighlight])

  // Country coverage markers — visible only when zoomed out (≤ 5.5).
  // A country marker is a status claim, never a place pin; zooming in
  // hands the canvas back to pins and dots.
  const countryMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const onCountrySelectRef = useRef(onCountrySelect)
  onCountrySelectRef.current = onCountrySelect
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    countryMarkersRef.current.forEach((m) => m.remove())
    countryMarkersRef.current.clear()
    if (!countries || countries.length === 0) return

    const STATUS_STYLE: Record<CountryMarker['status'], { dot: string; text: string }> = {
      live: { dot: '#0D7A72', text: '#0D7A72' },
      planned: { dot: '#D97E00', text: '#8A5A10' },
      uncovered: { dot: '#9aa5a3', text: '#5f6b69' },
    }
    const visibleAtZoom = (z: number) => z <= 5.5
    const applyVisibility = () => {
      const show = visibleAtZoom(map.getZoom())
      countryMarkersRef.current.forEach((m) => {
        const el = m.getElement()
        el.style.display = show ? 'flex' : 'none'
      })
    }

    for (const c of countries) {
      const s = STATUS_STYLE[c.status]
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;transition:opacity .2s`
      wrapper.innerHTML = `
        <div style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.93);border:1px solid rgba(23,39,43,.12);border-radius:999px;padding:3px 9px 3px 6px;box-shadow:0 2px 8px rgba(23,39,43,.18)">
          <span style="width:9px;height:9px;border-radius:50%;background:${s.dot};box-shadow:0 0 0 3px ${s.dot}25"></span>
          <span style="font:800 11px/1 ui-sans-serif,system-ui;white-space:nowrap;color:#17272B">${c.label}</span>
        </div>
        <span style="font:700 9px/1.3 ui-sans-serif,system-ui;white-space:nowrap;color:${s.text};background:rgba(255,255,255,.85);padding:1px 5px;border-radius:6px;margin-top:2px">${c.statusLabel}</span>`
      const el = wrapper as HTMLElement
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onCountrySelectRef.current?.(c.code)
        map.flyTo({ center: [c.lng, c.lat], zoom: 11, duration: 1600 })
      })
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .addTo(map)
      countryMarkersRef.current.set(c.code, marker)
    }
    applyVisibility()
    map.on('zoom', applyVisibility)
    return () => {
      /* eslint-disable-next-line react-hooks/exhaustive-deps */
      map.off('zoom', applyVisibility)
      countryMarkersRef.current.forEach((m) => m.remove())
      countryMarkersRef.current.clear()
    }
  }, [countries])

  // Zone markers — the map-native picker (mid-zoom band). Country markers
  // cover zoom ≤ 5.5; these take over from there up to street level.
  const zoneMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const onZoneSelectRef = useRef(onZoneSelect)
  onZoneSelectRef.current = onZoneSelect
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    zoneMarkersRef.current.forEach((m) => m.remove())
    zoneMarkersRef.current.clear()
    if (!zones || zones.length === 0) return

    const visibleAtZoom = (z: number) => z > 5.5 && z <= 9
    const applyVisibility = () => {
      const show = visibleAtZoom(map.getZoom())
      zoneMarkersRef.current.forEach((m) => {
        m.getElement().style.display = show ? 'flex' : 'none'
      })
    }

    for (const z of zones) {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `display:flex;align-items:center;cursor:pointer;pointer-events:auto`
      wrapper.innerHTML = `
        <div style="display:flex;align-items:center;gap:4px;background:${z.selected ? '#0D7A72' : 'rgba(255,255,255,.93)'};border:1px solid ${z.selected ? '#0D7A72' : 'rgba(23,39,43,.14)'};border-radius:999px;padding:2px 8px 2px 5px;box-shadow:0 2px 6px rgba(23,39,43,.2)">
          <span style="font-size:9px">${z.selected ? '📍' : '⚪'}</span>
          <span style="font:800 10px/1.2 ui-sans-serif,system-ui;white-space:nowrap;color:${z.selected ? '#fff' : '#17272B'}">${z.label}</span>
        </div>`
      const el = wrapper as HTMLElement
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onZoneSelectRef.current?.(z.id)
      })
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([z.lng, z.lat])
        .addTo(map)
      zoneMarkersRef.current.set(z.id, marker)
    }
    applyVisibility()
    map.on('zoom', applyVisibility)
    return () => {
      map.off('zoom', applyVisibility)
      zoneMarkersRef.current.forEach((m) => m.remove())
      zoneMarkersRef.current.clear()
    }
  }, [zones])

  // Imperative fly-to (country/city selection) — nonce-keyed so picking
  // the same target twice still flies.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 11, duration: 1500 })
  }, [flyTo?.nonce])

  // Fly to selected pin
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedPinId) return
    const pin = pins.find(p => p.id === selectedPinId)
    if (pin) {
      map.flyTo({ center: [pin.lng, pin.lat], zoom: map.getZoom(), duration: 600 })
    }
  }, [selectedPinId, pins])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', backgroundImage: fallbackImage ? `url(${fallbackImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', ...style }} />
}

interface TreasurePin {
  id: string
  lat: number
  lng: number
  label: string
}

export function GuacaMapTreasure({
  pins,
  center = [-68.0075, 10.4665],
  zoom = 15,
  className,
  style,
}: {
  pins: TreasurePin[]
  center?: [number, number]
  zoom?: number
  className?: string
  style?: React.CSSProperties
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const pinPositions = useMemo(() => deCollide(pins), [pins])

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center,
      zoom,
      pitch: 0,
      bearing: 0,
      projection: 'mercator',
      attributionControl: true,
      maxZoom: 19,
      minZoom: 12,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      const layers = map.getStyle().layers
      if (layers) {
        for (const layer of layers) {
          if (layer.type === 'symbol' && layer.layout) {
            map.setLayerProperty(layer.id, 'text-opacity', 0.7)
          }
        }
      }

      pins.forEach((pin) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = createTreasureHTML()
        const el = wrapper.firstElementChild as HTMLElement
        if (!el) return

        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(pinPositions.get(pin.id) ?? [pin.lng, pin.lat])
          .addTo(map)
      })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', ...style }} />
}
