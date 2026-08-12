// GuacaIcons.tsx — Rich illustrated icons for the GUACA prototype
// Uses authored SVG role illustrations, a detailed parrot, and Lucide for functional icons.

import {
  Utensils, Wine, Umbrella, Landmark, ShoppingBag, Music, TreePine, Wrench,
  Camera, Trophy, Anchor, Star, Footprints, Sailboat, Shirt, Sun,
  Store, Building2, Map, Users, Eye, Megaphone, TrendingUp, ChevronRight,
  Check, Heart, CalendarDays, MessageCircle, UserRound, MapPin, Search,
  Bell, Mic, PlusCircle, Package, PackageCheck, Clock, ArrowUpRight, Zap,
  Fish, GlassWater
} from 'lucide-react'

export {
  Utensils, Wine, Umbrella, Landmark, ShoppingBag, Music, TreePine, Wrench,
  Camera, Trophy, Anchor, Star, Footprints, Sailboat, Shirt, Sun,
  Store, Building2, Map, Users, Eye, Megaphone, TrendingUp, ChevronRight,
  Check, Heart, CalendarDays, MessageCircle, UserRound, MapPin, Search,
  Bell, Mic, PlusCircle, Package, PackageCheck, Clock, ArrowUpRight, Zap,
  Fish, GlassWater
}

// ─── ROLE ILLUSTRATION PHOTOS ───────────────────────────────────────────────
// Rich photographic images used inside circular cards on the role chooser

export const ROLE_PHOTOS = {
  tourist: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80',
  spotter: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=400&q=80',
  business: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=400&q=80',
}

// ─── ROLE ILLUSTRATIONS ───────────────────────────────────────────────────
// These are deliberately drawn in the same warm, outlined language as the
// reference rather than using unrelated stock photos for the three entry roles.

export function TouristIllustration({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="36" cy="36" r="34" fill="#DDF4F0" />
      <path d="M6 47c12-6 23-6 33-1 10 4 19 3 27-2v21H6V47Z" fill="#73C8C1" />
      <path d="M6 54c9-3 17-2 25 1 9 4 20 3 35-3v13H6V54Z" fill="#F4D69A" />
      <path d="M38 45c-1-14 4-24 14-30" stroke="#176B59" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M51 16c-8-2-13 1-16 8 7 1 12-1 16-8ZM52 17c7-3 12-1 15 4-6 2-11 1-15-4ZM47 22c-7 1-11 5-12 11 7 0 11-4 12-11ZM53 21c6 0 10 3 12 8-6 1-10-2-12-8Z" fill="#278C67" />
      <path d="M15 45c4-9 12-14 23-14-1 7-4 12-8 14H15Z" fill="#EF654B" />
      <path d="M26 45V32" stroke="#173744" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 59c5-2 10-2 15 0M43 59c5-2 10-2 15 0" stroke="#FFF8EC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function SpotterIllustration({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="36" cy="36" r="34" fill="#FFF0D1" />
      <path d="M8 57c8-11 16-17 25-18-2 8-7 15-14 21M64 56c-8-10-16-16-24-17 2 8 6 14 13 20" stroke="#278C67" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 39h36v25H18V39Z" fill="#C47A16" stroke="#74490C" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 40c0-10 8-18 20-18s20 8 20 18H16Z" fill="#E7A920" stroke="#74490C" strokeWidth="2" />
      <path d="M16 40h40M36 23v17M36 42v22" stroke="#74490C" strokeWidth="2" />
      <rect x="31" y="38" width="10" height="12" rx="2" fill="#FFD75A" stroke="#74490C" strokeWidth="1.6" />
      <circle cx="36" cy="44" r="1.4" fill="#74490C" />
      <circle cx="24" cy="24" r="4" fill="#FFD75A" /><circle cx="48" cy="25" r="3" fill="#FFD75A" />
    </svg>
  )
}

export function BusinessIllustration({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path d="M12 100c9-17 17-26 26-29M108 100c-8-18-16-27-25-30" stroke="#278C67" strokeWidth="5" strokeLinecap="round" />
      <path d="M27 49h67v52H27V49Z" fill="#FDF8ED" stroke="#173744" strokeWidth="2" />
      <path d="M21 47 30 29h61l10 18H21Z" fill="#159A97" stroke="#173744" strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 29 27 47M43 29l-1 18M56 29v18M69 29l1 18M82 29l4 18" stroke="#173744" strokeWidth="1.5" />
      <path d="M21 47c0 7 9 9 13 3 4 6 13 6 17 0 4 6 13 6 17 0 4 6 13 6 17 0 4 6 13 4 16-3" fill="#159A97" stroke="#173744" strokeWidth="2" />
      <rect x="36" y="61" width="28" height="22" rx="2" fill="#A9E0E2" stroke="#173744" strokeWidth="2" />
      <path d="m40 79 8-7 6 4 7-8" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M72 60h14v41H72V60Z" fill="#E4B467" stroke="#173744" strokeWidth="2" />
      <circle cx="82" cy="80" r="1.5" fill="#173744" />
      <path d="M18 102h90" stroke="#173744" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ParrotSVG({ className = '' }: { className?: string }) {
  return <ParrotHero className={className} />
}

export function GuacaParrotMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M27 45c-1 6-4 11-8 16 5-2 10-7 13-13l-5-3Z" fill="#0C4A5C" />
      <path d="M34 46c0 6 1 11 3 16 2-5 3-10 2-16h-5Z" fill="#0D8B8B" />
      <path d="M24 27c-5 5-6 13-2 19 4 6 13 8 19 3 6-5 6-15 1-21-5-5-13-6-18-1Z" fill="#E85D3A" />
      <path d="M34 29c6 3 9 9 8 17-5 2-10 0-13-4-3-5-2-10 5-13Z" fill="#0C4A5C" />
      <path d="M35 31c3 3 5 7 5 11-3-1-6-3-8-6l3-5Z" fill="#2E8B9E" />
      <circle cx="27" cy="20" r="11" fill="#F05C43" />
      <path d="M19 16c3-5 8-7 14-5-2-3-6-5-10-4 1 2 0 4-4 9Z" fill="#E85D3A" />
      <path d="M19 17c-4 0-7 2-9 5 4 1 7 1 10-1l-1-4Z" fill="#F0DDA8" />
      <path d="M18 21c-3 1-5 3-6 6 4 0 7-2 9-5l-3-1Z" fill="#0A2F3C" />
      <path d="M22 15c3-3 7-3 10 0-1 5-4 8-9 8-2-2-2-5-1-8Z" fill="#FFF8EE" />
      <circle cx="27" cy="16" r="2.3" fill="#0A2F3C" />
      <circle cx="27.6" cy="15.4" r=".8" fill="white" />
      <path d="M22 30c-4 2-7 6-8 11 4-2 8-5 10-9l-2-2Z" fill="#F0C74B" />
    </svg>
  )
}

// ─── SCARLET MACAW PARROT ──────────────────────────────────────────────────
// A detailed, colorful scarlet macaw — the GUACA mascot

export function ParrotHero({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Tail feathers — long, sweeping */}
      <path d="M52 100 Q44 120 30 140 Q38 130 48 112 Q50 108 52 100Z" fill="#1A6B5A"/>
      <path d="M56 100 Q50 125 42 145 Q48 132 56 110 Q57 105 56 100Z" fill="#0EA5A0"/>
      <path d="M60 100 Q56 128 52 148 Q55 134 60 112 Q60 106 60 100Z" fill="#14919B"/>
      <path d="M64 100 Q62 126 58 146 Q60 132 64 112 Q64 106 64 100Z" fill="#0D8B8B"/>
      <path d="M68 100 Q68 124 68 144 Q66 130 66 110 Q67 105 68 100Z" fill="#E8C94A"/>
      <path d="M72 98 Q76 120 80 140 Q76 124 72 106 Q71 102 72 98Z" fill="#F47B5A"/>

      {/* Body — bright red */}
      <ellipse cx="60" cy="78" rx="26" ry="30" fill="#E8432A"/>
      <ellipse cx="58" cy="76" rx="24" ry="28" fill="#F05138"/>
      <ellipse cx="56" cy="74" rx="20" ry="24" fill="#E8432A" opacity="0.6"/>

      {/* Chest/belly — lighter red-orange */}
      <ellipse cx="58" cy="84" rx="16" ry="18" fill="#F47852" opacity="0.7"/>

      {/* Wing — blue and yellow */}
      <path d="M36 60 Q30 70 28 88 Q32 82 38 72 Q40 66 36 60Z" fill="#1A5FAE"/>
      <path d="M34 64 Q26 76 24 92 Q30 84 36 74 Q38 68 34 64Z" fill="#2472C4"/>
      <path d="M82 58 Q88 68 92 86 Q86 80 80 70 Q78 64 82 58Z" fill="#1A5FAE"/>
      <path d="M84 62 Q92 74 96 90 Q88 82 82 72 Q80 66 84 62Z" fill="#2472C4"/>

      {/* Yellow/white wing bar */}
      <path d="M38 62 Q42 58 46 58 Q44 64 40 68Z" fill="#F7D948" opacity="0.9"/>
      <path d="M76 60 Q72 56 68 56 Q70 62 74 66Z" fill="#F7D948" opacity="0.9"/>

      {/* Green back/nape */}
      <path d="M48 48 Q52 40 60 38 Q68 40 72 48 Q66 44 60 42 Q54 44 48 48Z" fill="#0EA39D"/>
      <path d="M46 52 Q50 44 60 42 Q70 44 74 52 Q66 48 60 46 Q54 48 46 52Z" fill="#12BDB0" opacity="0.7"/>

      {/* Head — bright red */}
      <ellipse cx="60" cy="38" rx="18" ry="16" fill="#E8432A"/>
      <ellipse cx="58" cy="37" rx="16" ry="14" fill="#F05138"/>

      {/* White face patch */}
      <ellipse cx="52" cy="40" rx="10" ry="8" fill="#F5E6D8"/>
      <ellipse cx="51" cy="39" rx="8" ry="6" fill="#FFF5EB"/>

      {/* Eye — detailed */}
      <circle cx="50" cy="36" r="4" fill="#FFF"/>
      <circle cx="50" cy="36" r="2.5" fill="#1A1A1A"/>
      <circle cx="49.2" cy="35.2" r="1" fill="#FFF"/>

      {/* Beak — large, curved */}
      <path d="M42 42 Q38 46 36 52 Q38 50 42 46 Q44 44 42 42Z" fill="#2A2A2A"/>
      <path d="M42 42 L36 44 Q34 46 34 48 Q36 46 40 44Z" fill="#444"/>
      <path d="M42 42 Q44 40 48 40 Q46 42 44 44Z" fill="#F5E6D8" opacity="0.6"/>

      {/* Crown feathers — small tufts */}
      <path d="M54 24 Q56 18 52 14 Q54 18 56 22Z" fill="#E8432A"/>
      <path d="M60 22 Q62 16 58 12 Q60 16 62 20Z" fill="#F05138"/>
      <path d="M66 24 Q68 18 64 14 Q66 18 68 22Z" fill="#E8432A"/>

      {/* Subtle highlight on head */}
      <ellipse cx="56" cy="32" rx="6" ry="4" fill="#FFF" opacity="0.12"/>
    </svg>
  )
}

// ─── PALM FROND DECORATIONS ────────────────────────────────────────────────

export function PalmFrondLeft({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 Q20 30 25 60 Q15 45 0 30Z" fill="#1A6B5A" opacity="0.7"/>
      <path d="M0 10 Q25 45 30 80 Q18 60 0 40Z" fill="#0EA39D" opacity="0.6"/>
      <path d="M0 25 Q30 60 35 100 Q20 75 5 50Z" fill="#14919B" opacity="0.55"/>
      <path d="M5 40 Q35 80 38 120 Q25 95 10 65Z" fill="#0D8B8B" opacity="0.5"/>
      <path d="M10 55 Q40 95 42 140 Q30 115 15 80Z" fill="#12BDB0" opacity="0.4"/>
      <path d="M15 70 Q42 110 44 160 Q34 135 20 95Z" fill="#1A6B5A" opacity="0.35"/>
    </svg>
  )
}

export function PalmFrondRight({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'scaleX(-1)' }}>
      <path d="M0 0 Q20 30 25 60 Q15 45 0 30Z" fill="#1A6B5A" opacity="0.7"/>
      <path d="M0 10 Q25 45 30 80 Q18 60 0 40Z" fill="#0EA39D" opacity="0.6"/>
      <path d="M0 25 Q30 60 35 100 Q20 75 5 50Z" fill="#14919B" opacity="0.55"/>
      <path d="M5 40 Q35 80 38 120 Q25 95 10 65Z" fill="#0D8B8B" opacity="0.5"/>
      <path d="M10 55 Q40 95 42 140 Q30 115 15 80Z" fill="#12BDB0" opacity="0.4"/>
      <path d="M15 70 Q42 110 44 160 Q34 135 20 95Z" fill="#1A6B5A" opacity="0.35"/>
    </svg>
  )
}

// ─── TREASURE CHEST ILLUSTRATION ───────────────────────────────────────────

export function TreasureChest({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Chest body */}
      <rect x="8" y="28" width="48" height="28" rx="4" fill="#B8860B"/>
      <rect x="8" y="28" width="48" height="28" rx="4" fill="url(#chest-grad)"/>
      <rect x="10" y="30" width="44" height="24" rx="3" fill="#D4A017"/>

      {/* Chest lid */}
      <path d="M6 30 Q6 18 32 14 Q58 18 58 30Z" fill="#B8860B"/>
      <path d="M8 30 Q8 20 32 16 Q56 20 56 30Z" fill="#C9950A"/>
      <path d="M10 30 Q10 22 32 18 Q54 22 54 30Z" fill="#DAA520"/>

      {/* Metal bands */}
      <rect x="6" y="26" width="52" height="4" rx="2" fill="#8B6914"/>
      <rect x="8" y="40" width="48" height="3" rx="1.5" fill="#8B6914" opacity="0.7"/>

      {/* Lock/clasp */}
      <rect x="28" y="26" width="8" height="8" rx="2" fill="#FFD700"/>
      <circle cx="32" cy="30" r="2" fill="#B8860B"/>

      {/* Gold coins spilling */}
      <circle cx="18" cy="26" r="4" fill="#FFD700" opacity="0.9"/>
      <circle cx="24" cy="24" r="3.5" fill="#FFC800" opacity="0.85"/>
      <circle cx="44" cy="25" r="3" fill="#FFD700" opacity="0.9"/>
      <circle cx="48" cy="23" r="4" fill="#FFC800" opacity="0.8"/>
      <circle cx="36" cy="22" r="2.5" fill="#FFE44D" opacity="0.75"/>

      {/* Coin shine */}
      <circle cx="17" cy="25" r="1" fill="#FFF" opacity="0.4"/>
      <circle cx="47" cy="22" r="1.2" fill="#FFF" opacity="0.35"/>

      <defs>
        <linearGradient id="chest-grad" x1="8" y1="28" x2="56" y2="56">
          <stop stopColor="#DAA520" stopOpacity="0.3"/>
          <stop offset="1" stopColor="#8B6914" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── SVG BADGE ICONS for spotter reward badges ─────────────────────────────

export const BADGE_SVG: Record<string, string> = {
  trophy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  camera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  anchor: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" x2="12" y1="22" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>',
  star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  sunset: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="M20 12h3"/><path d="m19.07 4.93-2.12 2.12"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>',
  palm: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-4"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 4.24-4.24c1.96 1.96 1.8 5.28-.36 7.43"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/></svg>',
}
