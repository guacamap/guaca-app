'use client'

import { useState } from 'react'

/**
 * Privacy policy and terms. Google Play requires a reachable privacy policy
 * URL for any app with an account system, and the app's profile links here.
 * The text describes what the code actually does — keep it in sync.
 */
export type LegalDoc = 'privacy' | 'terms'

interface Section {
  heading: string
  body: string[]
}

interface DocCopy {
  title: string
  updated: string
  intro: string
  sections: Section[]
  contact: string
}

const CONTACT_EMAIL = 'hola@guaca.live'

const COPY: Record<'en' | 'es', Record<LegalDoc, DocCopy>> = {
  en: {
    privacy: {
      title: 'Privacy policy',
      updated: 'Last updated: 15 August 2026',
      intro:
        'Guaca is a map of places verified in person by local people. This policy explains what we store, why, and how to remove it.',
      sections: [
        {
          heading: 'What we store',
          body: [
            'Travellers: your email address, the language you chose, and the villa or posada whose QR code you scanned (if any). We send a one-time sign-in code to that address — there is no password.',
            'Your questions are stored WITHOUT a link to your account. They exist so the map can learn where coverage is missing. When you tap "tell me when it is verified", we create a separate link between that one question and your account so we can email you; you can cancel it in the app.',
            'Places you save, posts you write, and any Reel or TikTok link you attach are stored with your account.',
            'Spotters: name, phone number, area, profile photo, and the photos and GPS coordinates captured when verifying a place. Verification photos are inspected automatically and kept as evidence that a place was really visited.',
          ],
        },
        {
          heading: 'What we never do',
          body: [
            'We do not sell your data, and we do not use it for advertising.',
            'We do not track you across other apps or websites.',
            'Our AI answers only from places locals have verified. It is not trained on your personal data.',
          ],
        },
        {
          heading: 'Services we use',
          body: [
            'Mapbox renders the map. Resend delivers sign-in emails. An AI inference provider processes the text of your question and verification photos to produce answers and checks. Map data comes from OpenStreetMap contributors.',
            'Data is stored on servers we operate, with encrypted connections.',
          ],
        },
        {
          heading: 'Your choices',
          body: [
            'You can delete your account at any time from your profile, or at guaca.live/delete-account. Deleting removes your email and personal records. Your past questions remain, permanently anonymous, because the map coverage they created belongs to the community.',
            'You can cancel a "tell me when verified" watch, remove saved places, and switch language at any time.',
          ],
        },
        {
          heading: 'Children',
          body: ['Guaca is not intended for children under 13.'],
        },
      ],
      contact: `Questions about privacy: ${CONTACT_EMAIL}`,
    },
    terms: {
      title: 'Terms of use',
      updated: 'Last updated: 15 August 2026',
      intro: 'By using Guaca you agree to these terms.',
      sections: [
        {
          heading: 'What Guaca is',
          body: [
            'Guaca shows places that named local people physically visited and photographed. When nobody has verified a place, Guaca says so instead of guessing.',
            'Information can still go out of date. Opening hours, prices and conditions change. Check before you travel, and use your own judgement about safety.',
          ],
        },
        {
          heading: 'Accounts',
          body: [
            'Travellers sign in with an email code. Spotter accounts are issued by an operator — there is no self-signup, because every Spotter is a real, accountable person in their community.',
            'Keep your sign-in codes to yourself. Tell us if you think someone else used your account.',
          ],
        },
        {
          heading: 'What you post',
          body: [
            'You keep ownership of the tips, photos and links you post, and you give Guaca permission to display them in the app.',
            'Post only content you have the right to share, that is about the place, and that is not abusive, misleading or illegal. We may hide content that breaks this rule.',
            'Star ratings only count when you post from the place itself.',
          ],
        },
        {
          heading: 'Spotter points',
          body: [
            'Spotters earn points for verified missions. Points are a reward programme, not money, and have no cash value. Fabricated or copied submissions forfeit points and can end an account.',
          ],
        },
        {
          heading: 'Availability',
          body: [
            'Guaca is offered as-is during its Caribbean pilot. Features can change, and service may be interrupted. We are not liable for losses arising from use of the app, to the extent the law allows.',
          ],
        },
      ],
      contact: `Questions about these terms: ${CONTACT_EMAIL}`,
    },
  },
  es: {
    privacy: {
      title: 'Política de privacidad',
      updated: 'Última actualización: 15 de agosto de 2026',
      intro:
        'Guaca es un mapa de lugares verificados en persona por gente local. Esta política explica qué guardamos, para qué y cómo eliminarlo.',
      sections: [
        {
          heading: 'Qué guardamos',
          body: [
            'Viajeros: tu correo electrónico, el idioma que elegiste y la villa o posada cuyo código QR escaneaste (si aplica). Enviamos un código de un solo uso a ese correo — no hay contraseña.',
            'Tus preguntas se guardan SIN vínculo con tu cuenta. Existen para que el mapa sepa dónde falta cobertura. Cuando tocas «avísame cuando esté verificado», creamos un vínculo aparte entre esa pregunta y tu cuenta para poder escribirte; puedes cancelarlo en la app.',
            'Los lugares que guardas, las publicaciones que escribes y cualquier enlace de Reel o TikTok que adjuntes se guardan con tu cuenta.',
            'Spotters: nombre, teléfono, zona, foto de perfil, y las fotos y coordenadas GPS capturadas al verificar un lugar. Las fotos de verificación se revisan automáticamente y se conservan como evidencia de que el lugar fue visitado de verdad.',
          ],
        },
        {
          heading: 'Lo que nunca hacemos',
          body: [
            'No vendemos tus datos ni los usamos para publicidad.',
            'No te rastreamos en otras apps o sitios web.',
            'Nuestra IA responde solo con lugares verificados por locales. No se entrena con tus datos personales.',
          ],
        },
        {
          heading: 'Servicios que usamos',
          body: [
            'Mapbox dibuja el mapa. Resend entrega los correos de acceso. Un proveedor de inferencia de IA procesa el texto de tu pregunta y las fotos de verificación para generar respuestas y comprobaciones. Los datos del mapa provienen de colaboradores de OpenStreetMap.',
            'Los datos se almacenan en servidores que operamos, con conexiones cifradas.',
          ],
        },
        {
          heading: 'Tus opciones',
          body: [
            'Puedes eliminar tu cuenta cuando quieras desde tu perfil o en guaca.live/delete-account. Al eliminarla borramos tu correo y tus registros personales. Tus preguntas anteriores quedan, permanentemente anónimas, porque la cobertura del mapa que crearon pertenece a la comunidad.',
            'Puedes cancelar un aviso de «avísame cuando esté verificado», quitar lugares guardados y cambiar de idioma cuando quieras.',
          ],
        },
        {
          heading: 'Menores',
          body: ['Guaca no está dirigida a menores de 13 años.'],
        },
      ],
      contact: `Preguntas sobre privacidad: ${CONTACT_EMAIL}`,
    },
    terms: {
      title: 'Términos de uso',
      updated: 'Última actualización: 15 de agosto de 2026',
      intro: 'Al usar Guaca aceptas estos términos.',
      sections: [
        {
          heading: 'Qué es Guaca',
          body: [
            'Guaca muestra lugares que personas locales con nombre visitaron y fotografiaron físicamente. Cuando nadie ha verificado un lugar, Guaca lo dice en vez de inventar.',
            'La información puede quedar desactualizada. Horarios, precios y condiciones cambian. Verifica antes de ir y usa tu propio criterio sobre seguridad.',
          ],
        },
        {
          heading: 'Cuentas',
          body: [
            'Los viajeros entran con un código enviado al correo. Las cuentas de Spotter las emite un operador — no hay registro abierto, porque cada Spotter es una persona real y responsable en su comunidad.',
            'No compartas tus códigos de acceso. Avísanos si crees que alguien más usó tu cuenta.',
          ],
        },
        {
          heading: 'Lo que publicas',
          body: [
            'Conservas la propiedad de los datos, fotos y enlaces que publicas, y le das permiso a Guaca para mostrarlos en la app.',
            'Publica solo contenido que tengas derecho a compartir, que sea sobre el lugar y que no sea abusivo, engañoso ni ilegal. Podemos ocultar contenido que rompa esta regla.',
            'Las estrellas solo cuentan si publicas desde el lugar.',
          ],
        },
        {
          heading: 'Puntos de Spotter',
          body: [
            'Los Spotters ganan puntos por misiones verificadas. Los puntos son un programa de recompensas, no dinero, y no tienen valor en efectivo. Las entregas inventadas o copiadas pierden los puntos y pueden cerrar la cuenta.',
          ],
        },
        {
          heading: 'Disponibilidad',
          body: [
            'Guaca se ofrece tal cual durante su piloto en el Caribe. Las funciones pueden cambiar y el servicio puede interrumpirse. No somos responsables por pérdidas derivadas del uso de la app, en la medida que la ley lo permita.',
          ],
        },
      ],
      contact: `Preguntas sobre estos términos: ${CONTACT_EMAIL}`,
    },
  },
}

function LegalBody({ doc }: { doc: LegalDoc }) {
  // Local state, not the shared provider: these pages must stay tiny —
  // importing the UI barrel would pull Mapbox into a static legal page.
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const t = COPY[lang][doc]

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-guaca-paper px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <a href="/" className="guaca-script text-3xl font-black text-guaca-teal" aria-label="Guaca">
          Guaca
        </a>
        <div className="flex overflow-hidden rounded-full bg-guaca-sand/60 p-0.5">
          {(['en', 'es'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-black transition-colors ${lang === code ? 'bg-guaca-teal text-white' : 'text-guaca-ink/55'}`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <h1 className="mt-8 text-3xl font-black tracking-[-.03em] text-guaca-ink">{t.title}</h1>
      <p className="mt-1 text-[11px] font-bold text-guaca-ink/45">{t.updated}</p>
      <p className="mt-4 text-[14px] font-semibold leading-relaxed text-guaca-ink/70">{t.intro}</p>

      {t.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-[15px] font-black text-guaca-teal">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-[13px] font-medium leading-relaxed text-guaca-ink/70">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="mt-10 rounded-2xl bg-guaca-teal/8 px-4 py-3 text-[12px] font-bold text-guaca-teal-dark">
        {t.contact}
      </p>

      <div className="mt-6 flex gap-4 text-[11px] font-bold text-guaca-ink/45">
        <a href="/privacy" className="underline-offset-2 hover:underline">Privacy</a>
        <a href="/terms" className="underline-offset-2 hover:underline">Terms</a>
        <a href="/delete-account" className="underline-offset-2 hover:underline">Delete account</a>
      </div>
    </main>
  )
}

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return <LegalBody doc={doc} />
}
