/**
 * The one category-to-glyph bridge between the React components (list
 * fallbacks, filter chips — lucide-react components) and the map's DOM
 * markers, which live outside React and can only take an SVG string
 * (`MapPin.iconSvg`). The path data below is copied verbatim from the
 * installed lucide-react 0.563.0 (ISC licence) — the same glyphs the
 * components render, never scraped or hand-drawn substitutes, so a marker's
 * fallback face and its discovery row show the same symbol.
 */

type IconNode = Array<[tag: 'path' | 'circle' | 'polyline', attrs: Record<string, string>]>

const CATEGORY_NODES: Record<string, IconNode> = {
  // Utensils
  eat_drink: [
    ['path', { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' }],
    ['path', { d: 'M7 2v20' }],
    ['path', { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' }],
  ],
  // Waves
  beach_water: [
    ['path', { d: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' }],
    ['path', { d: 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' }],
    ['path', { d: 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' }],
  ],
  // Leaf
  nature_walk: [
    ['path', { d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z' }],
    ['path', { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' }],
  ],
  // Landmark
  culture_history: [
    ['path', { d: 'M10 18v-7' }],
    ['path', { d: 'M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z' }],
    ['path', { d: 'M14 18v-7' }],
    ['path', { d: 'M18 18v-7' }],
    ['path', { d: 'M3 22h18' }],
    ['path', { d: 'M6 18v-7' }],
  ],
  // ShoppingBag
  market_shop: [
    ['path', { d: 'M16 10a4 4 0 0 1-8 0' }],
    ['path', { d: 'M3.103 6.034h17.794' }],
    ['path', { d: 'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z' }],
  ],
  // Music2
  nightlife_music: [
    ['circle', { cx: '8', cy: '18', r: '4' }],
    ['path', { d: 'M12 18V2l7 4' }],
  ],
  // Wrench
  services: [
    ['path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z' }],
  ],
  // Compass
  practical: [
    ['path', { d: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z' }],
    ['circle', { cx: '12', cy: '12', r: '10' }],
  ],
  // BedDouble
  lodging: [
    ['path', { d: 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8' }],
    ['path', { d: 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4' }],
    ['path', { d: 'M12 4v6' }],
    ['path', { d: 'M2 18h20' }],
  ],
}

/** The category's glyph as a standalone stroke SVG string, sized for a pin
 *  face. Same path data the React icons use; an unknown category returns
 *  undefined so the caller falls back to the map's location-pin glyph. */
const TASK_NODES: Record<string, IconNode> = {
  // Camera
  hours: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 6v6l4 2' }],
  ],
  access: [
    ['path', { d: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' }],
    ['path', { d: 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' }],
    ['path', { d: 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' }],
  ],
  evidence: [
    ['path', { d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' }],
    ['circle', { cx: '12', cy: '13', r: '3' }],
  ],
  witness: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
  ],
  completed: [
    ['path', { d: 'M21.801 10A10 10 0 1 1 17 3.335' }],
    ['path', { d: 'm9 11 3 3L22 4' }],
  ],
}

function svgFrom(node: IconNode | undefined, size: number): string | undefined {
  if (!node) return undefined
  const body = node.map(([tag, attrs]) => {
    const attrText = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')
    return `<${tag} ${attrText}></${tag}>`
  }).join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}

/** Map glyph for a Spotter task. Status picks the two-person or check mark
 *  so colour is never the only signal. */
export function missionTaskIconSvg(
  taskKind: string | null | undefined,
  status: string,
  size = 16,
): string | undefined {
  if (status === 'submitted') return svgFrom(TASK_NODES.witness, size)
  if (status === 'verified' || status === 'paid') return svgFrom(TASK_NODES.completed, size)
  if (taskKind === 'hours') return svgFrom(TASK_NODES.hours, size)
  if (taskKind === 'access') return svgFrom(TASK_NODES.access, size)
  return svgFrom(TASK_NODES.evidence, size)
}

export function categoryIconSvg(category: string, size = 16): string | undefined {
  const node = CATEGORY_NODES[category]
  if (!node) return undefined
  const body = node.map(([tag, attrs]) => {
    const attrText = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')
    return `<${tag} ${attrText}></${tag}>`
  }).join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}
