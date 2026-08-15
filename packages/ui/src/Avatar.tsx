import { useState } from 'react'

/**
 * A face with a guaranteed fallback. Spotter photos come from operator-set
 * URLs and uploads, so a dead link must degrade to initials rather than a
 * broken-image icon — these faces are the product's trust signal.
 */
export function Avatar({
  url,
  name,
  className = 'h-9 w-9',
  fallbackClassName = 'bg-guaca-teal text-white',
  textClassName = 'text-[11px]',
}: {
  url?: string | null
  name?: string | null
  className?: string
  fallbackClassName?: string
  textClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  /*
   * Only render images we serve. photo_url is operator-writable, and
   * pointing it at an arbitrary host would leak every viewer's IP there
   * (and render whatever that host chose). Spotters upload through
   * /api/spotter/:id/photo, which is same-origin.
   */
  const sameOrigin =
    !!url &&
    (url.startsWith('/') ||
      (typeof window !== 'undefined' && url.startsWith(window.location.origin)))
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '·'

  if (url && sameOrigin && !failed) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} ${fallbackClassName} ${textClassName} grid shrink-0 place-items-center rounded-full font-black`}
    >
      {initials}
    </span>
  )
}
