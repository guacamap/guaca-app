import { useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { useLanguage } from '@guaca/ui'
import type { PublicPlaceProfile as Profile } from '@guaca/shared'

export function PublicPlaceProfile({ profile, name }: { profile: Profile; name: string }) {
  const { lang } = useLanguage()
  const es = lang === 'es'
  const [failedImage, setFailedImage] = useState<string | null>(null)
  return <section className="public-place-profile" aria-label={es ? 'Información del lugar' : 'About this place'}>
    {profile.image && failedImage !== profile.image.url && <figure className="profile-photo">
      <img src={profile.image.url} alt={profile.image.caption ? profile.image.caption[lang] : name} width={640} height={400} onError={() => setFailedImage(profile.image!.url)} />
      <figcaption><a href={profile.image.sourceUrl} target="_blank" rel="noopener noreferrer">{profile.image.credit}</a>{'license' in profile.image &&
        <> · <a href={profile.image.licenseUrl} target="_blank" rel="noopener noreferrer">{profile.image.license}</a></>}
        {profile.image.caption && <span className="profile-photo-caption">{profile.image.caption[lang]}</span>}
      </figcaption>
    </figure>}
    <p className="profile-summary">{profile.summary[lang]}</p>
    <a className="profile-maps-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Puerto Cabello, Venezuela`)}`} target="_blank" rel="noopener noreferrer"><MapPin size={17} />{es ? 'Ver en Google Maps' : 'View on Google Maps'}<ExternalLink size={14} /></a>
    <details className="profile-sources"><summary>{es ? 'Fuentes y fecha de consulta' : 'Sources and research date'}</summary>
      <p>{es ? 'Consultado' : 'Researched'} {profile.researchedAt}. {es ? 'Confirma horarios y disponibilidad directamente con el lugar.' : 'Confirm hours and availability directly with the place.'}</p>
      {profile.sources.map((s) => <a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.label}<ExternalLink size={13} /></a>)}
    </details>
  </section>
}
