import { useEffect, useRef } from 'react'
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
}

interface GapPin {
  id: string
  lat: number
  lng: number
  label: string
  asks: number
  category: string
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
function installDataLayers(map: mapboxgl.Map, dots: MapDot[], heat: HeatPoint[]) {
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
}

function createPinHTML(_emoji: string, iconSvg: string | undefined, color: string, verified: boolean, isSelected: boolean, ratingBadge?: string) {
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
  const dotsRef = useRef<MapDot[]>(dots ?? [])
  const heatRef = useRef<HeatPoint[]>(heat ?? [])
  const onDotClickRef = useRef(onDotClick)
  dotsRef.current = dots ?? []
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
      minZoom: zoom < 12 ? 2.5 : 12,
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
      installDataLayers(map, dotsRef.current, heatRef.current)
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
      installDataLayers(map, dotsRef.current, heatRef.current)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()

      pins.forEach((pin) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = createPinHTML(pin.emoji, pin.iconSvg, pin.spotterColor, pin.verified, pin.id === selectedPinId, pin.ratingBadge)
        const el = wrapper.firstElementChild as HTMLElement
        if (!el) return
        makeMarkerInteractive(el, pin.label, () => onPinClick?.(pin.id))
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pin.lng, pin.lat])
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
      wrapper.innerHTML = createPinHTML(pin.emoji, pin.iconSvg, pin.spotterColor, pin.verified, pin.id === selectedPinId, pin.ratingBadge)
      const el = wrapper.firstElementChild as HTMLElement
      if (!el) return

      makeMarkerInteractive(el, pin.label, () => onPinClick?.(pin.id))

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
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
    installDataLayers(map, dots ?? [], heat ?? [])
  }, [dots, heat])

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
          .setLngLat([pin.lng, pin.lat])
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
