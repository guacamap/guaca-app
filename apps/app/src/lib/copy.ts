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
    devCodeHint: string
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
  spotter: {
    gateTitle: string
    gateLede: string
    phoneLabel: string
    codeLabel: string
    loginCta: string
    loginFailed: string
    tabMissions: string
    tabConfirm: string
    tabEarnings: string
    missionsTitle: string
    missionsEmpty: string
    acceptCta: string
    startCta: string
    statusOffered: string
    statusAccepted: string
    statusSubmitted: string
    statusVerified: string
    statusPaid: string
    reward: string
    captureTitle: string
    nameLabel: string
    landmarkLabel: string
    landmarkHint: string
    locationCta: string
    locationOk: string
    locationMissing: string
    photosLabel: string
    photosHint: string
    submitCta: string
    submitting: string
    resultSecondLocal: string
    resultOperator: string
    resultRejected: string
    retryCta: string
    confirmTitle: string
    confirmLede: string
    confirmEmpty: string
    confirmCta: string
    confirmed: string
    earningsTitle: string
    earningsEmpty: string
    backCta: string
    error: string
    confirmPending: string
    geoDenied: string
    alreadyDecided: string
    reasons: Record<string, string>
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
      devCodeHint: 'Dev build — the code is always 000000.',
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
    spotter: {
      gateTitle: 'Spotter sign in',
      gateLede: 'Phone + the one-time code your operator gave you. No self-signup — every Spotter is invited.',
      phoneLabel: 'Phone',
      codeLabel: 'Code',
      loginCta: 'Enter',
      loginFailed: 'Phone or code not recognised — codes are single-use; ask your operator for a new one.',
      tabMissions: 'Missions',
      tabConfirm: 'Confirm',
      tabEarnings: 'Earnings',
      missionsTitle: 'Your missions',
      missionsEmpty: 'No missions yet — they arrive when travellers ask about places nobody has verified.',
      acceptCta: 'Accept mission',
      startCta: 'I am there — verify it',
      statusOffered: 'Offered',
      statusAccepted: 'Accepted',
      statusSubmitted: 'In verification',
      statusVerified: 'Verified',
      statusPaid: 'Paid',
      reward: 'Reward',
      captureTitle: 'Verify the place',
      nameLabel: 'Name, exactly as the sign shows',
      landmarkLabel: 'How to find it',
      landmarkHint: '"50m past the church, blue door" — landmarks, not addresses.',
      locationCta: 'Use my location',
      locationOk: 'Location captured',
      locationMissing: 'Location is required — the check ladder measures your distance to the pin.',
      photosLabel: '3 photos, different angles',
      photosHint: 'Camera only — front, the sign, and the street around it.',
      submitCta: 'Submit for verification',
      submitting: 'Uploading…',
      resultSecondLocal: 'Submitted. Another local now confirms it on the ground — then it goes live with your name on the pin.',
      resultOperator: 'Submitted. The operator will review it shortly.',
      resultRejected: 'The checks rejected this submission:',
      retryCta: 'Try again',
      confirmTitle: 'Confirm places near you',
      confirmLede: 'Another Spotter filed these. Confirm only what you can physically see.',
      confirmEmpty: 'Nothing waiting for a second local near you.',
      confirmCta: 'I see it — confirm',
      confirmed: 'Confirmed — it is live on the map.',
      earningsTitle: 'Your earnings',
      earningsEmpty: 'Completed missions and top-ups appear here.',
      backCta: 'Back',
      error: 'Connection failed — try again.',
      confirmPending: 'This place is still in checks — it unlocks for confirmation once they pass.',
      geoDenied: 'Location denied — showing places near the pilot centre instead.',
      alreadyDecided: 'This submission was already processed.',
      reasons: {
        TOO_FEW_PHOTOS: 'Fewer than 3 photos',
        STALE_CAPTURE: 'Photos taken outside the mission window',
        GEO_TOO_FAR: 'Photos taken too far from the pin',
        PHOTO_REUSE: 'A photo matches one already submitted',
        NO_DIVERSITY: 'The photos are too similar to each other',
        VISION_UNAVAILABLE: 'Image check unavailable — escalated to the operator',
        PHOTO_BYTES_UNAVAILABLE: 'Photo storage unavailable — escalated to the operator',
        MISSION_NOT_OPEN: 'The mission is no longer open',
        LADDER_PASSED: 'All checks passed',
        ALREADY_DECIDED: 'Already processed',
      },
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
      devCodeHint: 'Versión de desarrollo — el código siempre es 000000.',
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
    spotter: {
      gateTitle: 'Entrada de Spotter',
      gateLede: 'Teléfono + el código de un solo uso que te dio tu operador. No hay registro abierto — cada Spotter es invitado.',
      phoneLabel: 'Teléfono',
      codeLabel: 'Código',
      loginCta: 'Entrar',
      loginFailed: 'Teléfono o código no reconocido — los códigos son de un solo uso; pide otro a tu operador.',
      tabMissions: 'Misiones',
      tabConfirm: 'Confirmar',
      tabEarnings: 'Ganancias',
      missionsTitle: 'Tus misiones',
      missionsEmpty: 'Sin misiones todavía — llegan cuando los viajeros preguntan por lugares que nadie ha verificado.',
      acceptCta: 'Aceptar misión',
      startCta: 'Estoy aquí — verificarlo',
      statusOffered: 'Ofrecida',
      statusAccepted: 'Aceptada',
      statusSubmitted: 'En verificación',
      statusVerified: 'Verificada',
      statusPaid: 'Pagada',
      reward: 'Recompensa',
      captureTitle: 'Verifica el lugar',
      nameLabel: 'Nombre, tal como aparece en el letrero',
      landmarkLabel: 'Cómo encontrarlo',
      landmarkHint: '"50m después de la iglesia, puerta azul" — referencias, no direcciones.',
      locationCta: 'Usar mi ubicación',
      locationOk: 'Ubicación capturada',
      locationMissing: 'La ubicación es obligatoria — la escalera de chequeos mide tu distancia al pin.',
      photosLabel: '3 fotos, ángulos distintos',
      photosHint: 'Solo cámara — el frente, el letrero y la calle alrededor.',
      submitCta: 'Enviar a verificación',
      submitting: 'Subiendo…',
      resultSecondLocal: 'Enviado. Otro local lo confirma en el terreno — y queda en vivo con tu nombre en el pin.',
      resultOperator: 'Enviado. El operador lo revisará en breve.',
      resultRejected: 'Los chequeos rechazaron este envío:',
      retryCta: 'Intentar de nuevo',
      confirmTitle: 'Confirma lugares cerca de ti',
      confirmLede: 'Otro Spotter registró estos lugares. Confirma solo lo que puedas ver físicamente.',
      confirmEmpty: 'Nada esperando un segundo local cerca de ti.',
      confirmCta: 'Lo veo — confirmar',
      confirmed: 'Confirmado — ya está en vivo en el mapa.',
      earningsTitle: 'Tus ganancias',
      earningsEmpty: 'Las misiones completadas y las recargas aparecen aquí.',
      backCta: 'Volver',
      error: 'Falló la conexión — intenta de nuevo.',
      confirmPending: 'Este lugar sigue en chequeos — se desbloquea para confirmar cuando pasen.',
      geoDenied: 'Ubicación denegada — mostrando lugares cerca del centro del piloto.',
      alreadyDecided: 'Este envío ya fue procesado.',
      reasons: {
        TOO_FEW_PHOTOS: 'Menos de 3 fotos',
        STALE_CAPTURE: 'Fotos tomadas fuera de la ventana de la misión',
        GEO_TOO_FAR: 'Fotos tomadas demasiado lejos del pin',
        PHOTO_REUSE: 'Una foto coincide con otra ya enviada',
        NO_DIVERSITY: 'Las fotos son demasiado parecidas entre sí',
        VISION_UNAVAILABLE: 'Chequeo de imagen no disponible — escalado al operador',
        PHOTO_BYTES_UNAVAILABLE: 'Almacenamiento de fotos no disponible — escalado al operador',
        MISSION_NOT_OPEN: 'La misión ya no está abierta',
        LADDER_PASSED: 'Todos los chequeos pasaron',
        ALREADY_DECIDED: 'Ya fue procesado',
      },
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
