import { ArrowRight, Camera, Compass, Globe, Store } from 'lucide-react'
import { GuacaLogo, useLanguage } from '@guaca/ui'
import { JoinScene } from './JoinScene'
import { InstallApp } from './InstallApp'

type Role = 'tourist' | 'spotter' | 'merchant'

export function RoleChooser({ onChoose, onLogin }: { onChoose: (role: Role) => void; onLogin?: () => void }) {
  const { lang, setLang } = useLanguage()
  const es = lang === 'es'
  return (
    <JoinScene>
      <div className="join-layout">
        <header className="join-header">
          <GuacaLogo variant="reversed" className="h-14" />
          <div className="join-language" role="group" aria-label={es ? 'Idioma' : 'Language'}>
            <Globe size={16} aria-hidden="true" />
            {(['en', 'es'] as const).map((code) => <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={lang === code}>{code.toUpperCase()}</button>)}
          </div>
        </header>
        <main className="join-main">
          <div className="join-intro">
            <h1>{es ? 'El Caribe, un poco más cerca.' : 'The Caribbean, a little closer.'}</h1>
            <p>{es ? 'Lugares que descubrir. Gente que los conoce. Empieza por Puerto Cabello y deja que la curiosidad te lleve.' : 'Places to discover. People who know them. Start in Puerto Cabello and see where curiosity takes you.'}</p>
            <div className="join-location"><Compass size={18} aria-hidden="true" /><span>Puerto Cabello <span aria-hidden="true">·</span> Venezuela</span></div>
          </div>
          <section className="join-actions" aria-label={es ? 'Elige cómo explorar' : 'Choose how to explore'}>
            <button type="button" className="join-traveler" onClick={() => onChoose('tourist')}>
              <Compass size={26} aria-hidden="true" />
              <span><strong>{es ? 'Quiero explorar' : 'I’m here to explore'}</strong><span>{es ? 'Descubre lugares, pregunta y arma tu viaje.' : 'Find places, ask questions and plan your trip.'}</span></span>
              <ArrowRight size={22} aria-hidden="true" />
            </button>
            <button type="button" className="join-spotter" onClick={() => onChoose('spotter')}>
              <Camera size={24} aria-hidden="true" />
              <span><strong>{es ? 'Soy Spotter' : 'I’m a Spotter'}</strong><span>{es ? 'Verifica lugares y comparte lo que sabes.' : 'Verify places and share what you know.'}</span></span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <button type="button" className="join-merchant" onClick={() => onChoose('merchant')}>
              <Store size={24} aria-hidden="true" />
              <span><strong>{es ? 'Tengo un alojamiento' : 'I host a stay'}</strong><span>{es ? 'Confirma solicitudes y actualiza tu listado.' : 'Confirm requests and keep your listing current.'}</span></span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <p className="join-login">{es ? '¿Ya tienes una cuenta?' : 'Already have an account?'} <button type="button" onClick={onLogin}>{es ? 'Iniciar sesión' : 'Log in'}</button></p>
            <InstallApp tone="dark" />
          </section>
        </main>
        <footer className="join-footer"><span>{es ? 'El conocimiento local hace la diferencia.' : 'Local knowledge makes the difference.'}</span><span>{es ? 'Beta del Caribe' : 'Caribbean beta'}</span></footer>
      </div>
    </JoinScene>
  )
}
