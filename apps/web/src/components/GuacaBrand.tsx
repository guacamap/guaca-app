import type { HTMLAttributes, ImgHTMLAttributes } from 'react'

type LogoVariant = 'primary' | 'reversed'

interface GuacaLogoProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: LogoVariant
  imageClassName?: string
}

/*
 * Brand assets extracted from the canonical reference renders:
 * - guaca-mark.png — the realistic macaw on its branch (transparent raster;
 *   a faithful vector of this bird is not achievable, so it ships as PNG).
 * - guaca-wordmark.png — flowing brush-script "Guaca" in brand teal.
 * The reversed variant turns the wordmark white via CSS filter so the same
 * asset works on teal/dark headers; the macaw keeps its true colors.
 */
export function GuacaLogo({ variant = 'primary', className = '', imageClassName = '', ...props }: GuacaLogoProps) {
  return (
    <span className={`guaca-logo ${variant === 'reversed' ? 'guaca-logo-reversed' : ''} ${className}`} {...props}>
      <img aria-hidden="true" alt="" src="/brand/guaca-mark.png" className={`guaca-logo-mark ${imageClassName}`} draggable={false} />
      <img aria-hidden="true" alt="" src="/brand/guaca-wordmark.png" className="guaca-logo-word" draggable={false} />
    </span>
  )
}

export function GuacaMark({ className = '', ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  return <img aria-hidden="true" alt="" src="/brand/guaca-mark.png" className={className} draggable={false} {...props} />
}
