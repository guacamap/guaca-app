import { useEffect, useRef, useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import type { PublicPlaceProfile as Profile } from '@guaca/shared'

export function PublicPlaceProfile({ profile, name }: { profile: Profile; name: string }) {
  const { lang } = useLanguage()
  const es = lang === 'es'
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const photoButtonRef = useRef<HTMLButtonElement>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)
  const image = profile.image && failedImage !== profile.image.url ? profile.image : null

  // The lightbox is a plain fixed overlay: Escape or a click anywhere closes
  // it, and focus returns to the photo button it was opened from.
  useEffect(() => {
    if (!lightboxOpen) return
    lightboxRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      photoButtonRef.current?.focus()
    }
  }, [lightboxOpen])

  return <section className="public-place-profile" aria-label={es ? 'Información del lugar' : 'About this place'}>
    {image && <figure className="profile-photo">
      <button ref={photoButtonRef} type="button" className="profile-photo-open" aria-haspopup="dialog" aria-label={es ? 'Ver la foto en grande' : 'View the photo full size'} onClick={() => setLightboxOpen(true)}>
        <img src={image.url} alt={image.caption ? image.caption[lang] : name} width={640} height={400} onError={() => setFailedImage(image.url)} />
      </button>
      <figcaption><a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a>{'license' in image &&
        <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a></>}
        {image.caption && <span className="profile-photo-caption">{image.caption[lang]}</span>}
      </figcaption>
    </figure>}
    <p className="profile-summary">{profile.summary[lang]}</p>
    {profile.gettingThere && <p className="profile-getting-there">
      <span className="profile-getting-there-label">{es ? 'Transporte usual · aproximado' : 'Usual transport · approximate'}</span>
      {profile.gettingThere[lang]}
    </p>}
    <a className="profile-maps-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Puerto Cabello, Venezuela`)}`} target="_blank" rel="noopener noreferrer"><MapPin size={17} />{es ? 'Ver en Google Maps' : 'View on Google Maps'}<ExternalLink size={14} /></a>
    <details className="profile-sources"><summary>{es ? 'Fuentes y fecha de consulta' : 'Sources and research date'}</summary>
      <p>{es ? 'Consultado' : 'Researched'} {profile.researchedAt}. {es ? 'Confirma horarios y disponibilidad directamente con el lugar.' : 'Confirm hours and availability directly with the place.'}</p>
      {profile.sources.map((s) => <a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.label}<ExternalLink size={13} /></a>)}
    </details>
    {image && lightboxOpen && <div ref={lightboxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={es ? 'Foto del lugar' : 'Place photo'} className="profile-lightbox" onClick={() => setLightboxOpen(false)}>
      <img src={image.url} alt={image.caption ? image.caption[lang] : name} />
      <p className="profile-lightbox-credit"><a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a>{'license' in image &&
        <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a></>}</p>
      {image.caption && <p className="profile-lightbox-caption">{image.caption[lang]}</p>}
    </div>}
  </section>
}
