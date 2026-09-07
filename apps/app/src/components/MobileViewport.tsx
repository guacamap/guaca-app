import { useEffect, useRef, type ReactNode } from 'react'

/** dvh does not consistently shrink for the software keyboard. Keep the
 * task shell within the visual viewport without disabling pinch zoom. */
export function MobileViewport({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      if (!root.current) return
      if (window.innerWidth >= 1024) {
        root.current.style.removeProperty('--app-height')
        return
      }
      if (Math.abs(viewport.scale - 1) > 0.01) return
      root.current.style.setProperty('--app-height', `${viewport.height}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      viewport.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return <div ref={root} className={`mobile-viewport ${className}`}>{children}</div>
}
