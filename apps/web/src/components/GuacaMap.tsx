import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim() ?? ''

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
}

interface GapPin {
  id: string
  lat: number
  lng: number
  label: string
  asks: number
  category: string
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
  selectedPinId?: string | null
  selectedGapId?: string | null
  onPinClick?: (id: string) => void
  onGapClick?: (id: string) => void
  mapStyle?: MapStyleId
  center?: [number, number]
  zoom?: number
  className?: string
  style?: React.CSSProperties
  fallbackImage?: string
}

function createPinHTML(_emoji: string, iconSvg: string | undefined, color: string, verified: boolean, isSelected: boolean) {
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
  selectedPinId,
  selectedGapId,
  onPinClick,
  onGapClick,
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
      attributionControl: false,
      maxZoom: 19,
      minZoom: zoom < 12 ? 2.5 : 12,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      // Slightly reduce label opacity for readability
      const layers = map.getStyle().layers
      if (layers) {
        for (const layer of layers) {
          if (layer.type === 'symbol' && layer.layout) {
            map.setLayerProperty(layer.id, 'text-opacity', 0.7)
          }
        }
      }
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
      // Re-add all markers after style swap clears them
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()

      pins.forEach((pin) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = createPinHTML(pin.emoji, pin.iconSvg, pin.spotterColor, pin.verified, pin.id === selectedPinId)
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
      wrapper.innerHTML = createPinHTML(pin.emoji, pin.iconSvg, pin.spotterColor, pin.verified, pin.id === selectedPinId)
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
      attributionControl: false,
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
