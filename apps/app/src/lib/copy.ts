import type { Lang } from '@guaca/ui'

/** Product-app strings (rule 18: every user-facing string through a
 *  typed EN/ES dictionary). */
export interface AppCopy {
  gate: {
    title: string
    lede: string
    emailLabel: string
    emailCta: string
    codeLabel: string
    codeLede: string
    codeCta: string
    resend: string
    invalidEmail: string
    badCode: string
    rateLimited: string
    networkError: string
  }
  villa: {
    connecting: string
    welcomePrefix: string
    continueCta: string
    notFound: string
    backHome: string
  }
  tourist: {
    askPlaceholder: string
    asking: string
    refusalTitle: string
    refusalNote: string
    answerTitle: string
    placesOnMap: string
    verifiedBy: string
    landmarkLabel: string
    close: string
    askError: string
    emptyMapTitle: string
    emptyMapBody: string
  }
}

export const appCopy: Record<Lang, AppCopy> = {
  en: {
    gate: {
      title: 'Sign in to ask',
      lede: 'One email, one code — no password. Your questions become the map.',
      emailLabel: 'Your email',
      emailCta: 'Send me a code',
      codeLabel: '6-digit code',
      codeLede: 'We sent a code to',
      codeCta: 'Enter',
      resend: 'Send a new code',
      invalidEmail: 'That email doesn’t look right.',
      badCode: 'Wrong or expired code — try again.',
      rateLimited: 'Too many tries — wait a few minutes.',
      networkError: 'Connection failed — try again.',
    },
    villa: {
      connecting: 'Connecting you to your stay…',
      welcomePrefix: 'Welcome, guest of',
      continueCta: 'Explore the map',
      notFound: 'This QR code isn’t active.',
      backHome: 'Go to Guaca',
    },
    tourist: {
      askPlaceholder: 'Ask Guaca about a place…',
      asking: 'Checking with the locals…',
      refusalTitle: 'No one has been there yet',
      refusalNote: 'Your question was recorded — it can open a paid Spotter mission.',
      answerTitle: 'Verified by locals',
      placesOnMap: 'on the map',
      verifiedBy: 'Physically visited by',
      landmarkLabel: 'How to find it',
      close: 'Close',
      askError: 'Couldn’t reach Guaca — try again.',
      emptyMapTitle: 'Coverage grows locally',
      emptyMapBody: 'Verified places appear as Spotters confirm them on the ground.',
    },
  },
  es: {
    gate: {
      title: 'Inicia sesión para preguntar',
      lede: 'Un correo, un código — sin contraseña. Tus preguntas se convierten en el mapa.',
      emailLabel: 'Tu correo',
      emailCta: 'Enviarme un código',
      codeLabel: 'Código de 6 dígitos',
      codeLede: 'Enviamos un código a',
      codeCta: 'Entrar',
      resend: 'Enviar un código nuevo',
      invalidEmail: 'Ese correo no parece válido.',
      badCode: 'Código incorrecto o vencido — intenta de nuevo.',
      rateLimited: 'Demasiados intentos — espera unos minutos.',
      networkError: 'Falló la conexión — intenta de nuevo.',
    },
    villa: {
      connecting: 'Conectándote con tu alojamiento…',
      welcomePrefix: 'Bienvenido, huésped de',
      continueCta: 'Explorar el mapa',
      notFound: 'Este código QR no está activo.',
      backHome: 'Ir a Guaca',
    },
    tourist: {
      askPlaceholder: 'Pregúntale a Guaca sobre un lugar…',
      asking: 'Consultando con los locales…',
      refusalTitle: 'Nadie ha estado ahí todavía',
      refusalNote: 'Tu pregunta quedó registrada — puede abrir una misión pagada para un Spotter.',
      answerTitle: 'Verificado por locales',
      placesOnMap: 'en el mapa',
      verifiedBy: 'Visitado físicamente por',
      landmarkLabel: 'Cómo encontrarlo',
      close: 'Cerrar',
      askError: 'No pudimos conectar con Guaca — intenta de nuevo.',
      emptyMapTitle: 'La cobertura crece localmente',
      emptyMapBody: 'Los lugares verificados aparecen cuando los Spotters los confirman en el terreno.',
    },
  },
}

export interface VillaAttribution {
  qrToken: string
  sessionId: string
  propertyId: string
  propertyName: string
}

const ATTRIBUTION_KEY = 'guaca-attribution'

export function saveAttribution(a: VillaAttribution) {
  window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(a))
}

export function loadAttribution(): VillaAttribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY)
    return raw ? (JSON.parse(raw) as VillaAttribution) : null
  } catch {
    return null
  }
}
