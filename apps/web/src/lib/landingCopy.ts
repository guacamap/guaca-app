import type { Lang } from '@guaca/ui'

/** Every user-facing string on the marketing landing, both languages.
 *  The interface keeps EN and ES structurally in sync at compile time. */
export interface LandingCopy {
  ariaHome: string
  ariaMainNav: string
  ariaJoinWaitlist: string
  ariaLanguage: string
  nav: { how: string; live: string; spotters: string; waitlist: string }
  joinWaitlist: string
  hero: {
    badge: string
    titleTop: string
    titleScript: string
    lede: string
    appComingSoon: string
    localVerification: string
    liveReports: string
  }
  phoneTourist: {
    imgAlt: string
    ask: string
    communities: string
    viewLabel: string
    viewTitle: string
    tabUpdates: string
    tabPlan: string
    tabStay: string
    verified: string
    businessPublished: string
    emptyTitle: string
    emptyBody: string
    navMap: string
    navPlan: string
    navUpdates: string
  }
  phoneSpotter: {
    badge: string
    sectionLabel: string
    title: string
    waitingSuffix: string
    reviewQueue: string
    queueBusy: string
    queueClear: string
    queueNote: string
    reviewCta: string
    whyTitle: string
    whyBody: string
  }
  how: { eyebrow: string; title: string; lede: string; joinAsPrefix: string }
  roles: {
    tourist: { title: string; description: string }
    spotter: { title: string; description: string }
    operator: { title: string; description: string }
  }
  live: {
    eyebrow: string
    titleTop: string
    titleScript: string
    lede: string
    features: [string, string, string, string]
    mapBadge: string
    emptyTitle: string
    emptyBody: string
  }
  spotters: {
    eyebrow: string
    title: string
    lede: string
    cta: string
    card1: string
    card2: string
    card2Sub: string
  }
  waitlist: {
    eyebrow: string
    title: string
    lede: string
    steps: [string, string, string]
    cardLede: string
    cardCta: string
    cardNote: string
  }
  businesses: { title: string; lede: string; comingSoon: string }
  footer: string
  deleteAccount: {
    title: string
    lede: string
    emailLabel: string
    sendCode: string
    codeLabel: string
    verify: string
    confirmTitle: string
    confirmBody: string
    confirmCta: string
    done: string
    error: string
    badCode: string
  }
}

export const landingCopy: Record<Lang, LandingCopy> = {
  en: {
    ariaHome: 'Guaca home',
    ariaMainNav: 'Main navigation',
    ariaJoinWaitlist: 'Join the Guaca waitlist',
    ariaLanguage: 'Language',
    nav: { how: 'How it works', live: 'Live updates', spotters: 'Spotters', waitlist: 'Waitlist' },
    joinWaitlist: 'Join the waitlist',
    hero: {
      badge: 'CARIBBEAN VISION · COMMUNITY-BY-COMMUNITY COVERAGE',
      titleTop: 'The Caribbean,',
      titleScript: 'en tiempo real.',
      lede: 'Guaca connects travellers with people on the ground across islands and coastal communities. Discover what is open, plan with current information, and reward the locals who keep each place useful.',
      appComingSoon: 'App coming soon',
      localVerification: 'Local verification',
      liveReports: 'Live reports',
    },
    phoneTourist: {
      imgAlt: 'Caribbean coverage inside the tourist app',
      ask: 'Ask Guaca about a place…',
      communities: 'Caribbean communities',
      viewLabel: 'Tourist view',
      viewTitle: 'What’s current nearby?',
      tabUpdates: 'Updates',
      tabPlan: 'Plan',
      tabStay: 'Stay',
      verified: 'Locally verified',
      businessPublished: 'Business-published',
      emptyTitle: 'Coverage grows locally',
      emptyBody: 'Current information appears as each community joins.',
      navMap: 'Map',
      navPlan: 'Plan',
      navUpdates: 'Updates',
    },
    phoneSpotter: {
      badge: 'SPOTTER',
      sectionLabel: 'Community verification',
      title: 'Keep local information useful.',
      waitingSuffix: 'waiting',
      reviewQueue: 'Review queue',
      queueBusy: 'Local updates need a spotter check.',
      queueClear: 'All caught up in your communities.',
      queueNote: 'Verify only what you can confirm on the ground.',
      reviewCta: 'Review information',
      whyTitle: 'Why it matters',
      whyBody: 'One local check makes an update more useful to every visitor.',
    },
    how: {
      eyebrow: 'Choose your way in',
      title: 'Three roles. One connected Caribbean.',
      lede: 'Every role strengthens the same local loop wherever Guaca grows: questions become verified updates, and useful updates become better days.',
      joinAsPrefix: 'Join as ',
    },
    roles: {
      tourist: {
        title: 'Tourist',
        description: 'Plan your day with current local information and experience each Caribbean community like someone who knows it.',
      },
      spotter: {
        title: 'Spotter',
        description: 'Share what is happening nearby, help your community, and unlock useful local rewards.',
      },
      operator: {
        title: 'Business',
        description: 'Be visible when locals and travellers are actively looking for what you offer.',
      },
    },
    live: {
      eyebrow: 'Live information you can trust',
      titleTop: 'Real updates from',
      titleScript: 'real people.',
      lede: 'From boat schedules to beach conditions, Guaca shows what is happening now and who verified it.',
      features: ['Verified locally', 'Updated now', 'Mapped live', 'Community led'],
      mapBadge: 'The Caribbean, live',
      emptyTitle: 'Coverage opens community by community',
      emptyBody: 'Business updates appear here the moment they’re published.',
    },
    spotters: {
      eyebrow: 'The heart of Guaca',
      title: 'Spotters keep the map alive.',
      lede: 'Local knowledge deserves recognition. Missions turn unanswered traveller questions into paid, visible community work.',
      cta: 'Join as a Spotter',
      card1: 'Missions with clear rewards',
      card2: 'Rewards that recognise real impact',
      card2Sub: 'Gear, badges, local experiences',
    },
    waitlist: {
      eyebrow: 'Join the first communities',
      title: 'Help decide where Guaca grows next.',
      lede: 'Tell us your role and the Caribbean community that matters to you. We’ll use the waitlist to prioritise real local demand—not pretend the whole region is already covered.',
      steps: ['Choose your role', 'Name your community', 'Hear from us when coverage is ready'],
      cardLede: 'The waitlist runs on a short form — your role, your community, about a minute.',
      cardCta: 'Open the waitlist form',
      cardNote: 'Opens Google Forms',
    },
    businesses: {
      title: 'Want to see how the product works?',
      lede: 'The tourist, spotter, and business experiences are almost ready — opening as community coverage grows.',
      comingSoon: 'App preview coming soon',
    },
    footer: 'The Caribbean, mapped by the people who know it.',
    deleteAccount: {
      title: 'Delete your account',
      lede: 'Sign in with your email code, then confirm. Your email — the only personal data we hold — is deleted immediately and permanently.',
      emailLabel: 'Your account email',
      sendCode: 'Send me a code',
      codeLabel: '6-digit code',
      verify: 'Continue',
      confirmTitle: 'Delete this account?',
      confirmBody: 'This removes your email and login permanently. Questions you asked stay on the map as anonymous demand — they were never linked to your name.',
      confirmCta: 'Delete my account',
      done: 'Your account has been deleted. Thank you for travelling with locals.',
      error: 'Connection failed — try again.',
      badCode: 'Wrong or expired code — try again.',
    },
  },
  es: {
    ariaHome: 'Inicio de Guaca',
    ariaMainNav: 'Navegación principal',
    ariaJoinWaitlist: 'Únete a la lista de espera de Guaca',
    ariaLanguage: 'Idioma',
    nav: { how: 'Cómo funciona', live: 'En vivo', spotters: 'Spotters', waitlist: 'Lista de espera' },
    joinWaitlist: 'Únete a la lista de espera',
    hero: {
      badge: 'VISIÓN CARIBEÑA · COBERTURA COMUNIDAD POR COMUNIDAD',
      titleTop: 'El Caribe,',
      titleScript: 'en tiempo real.',
      lede: 'Guaca conecta a los viajeros con personas en el terreno en islas y comunidades costeras. Descubre qué está abierto, planifica con información actual y premia a los locales que mantienen útil cada lugar.',
      appComingSoon: 'App muy pronto',
      localVerification: 'Verificación local',
      liveReports: 'Reportes en vivo',
    },
    phoneTourist: {
      imgAlt: 'Cobertura del Caribe dentro de la app de turista',
      ask: 'Pregúntale a Guaca sobre un lugar…',
      communities: 'Comunidades del Caribe',
      viewLabel: 'Vista turista',
      viewTitle: '¿Qué hay cerca ahora?',
      tabUpdates: 'Novedades',
      tabPlan: 'Planear',
      tabStay: 'Alojarse',
      verified: 'Verificado localmente',
      businessPublished: 'Publicado por el negocio',
      emptyTitle: 'La cobertura crece localmente',
      emptyBody: 'La información actual aparece a medida que cada comunidad se une.',
      navMap: 'Mapa',
      navPlan: 'Planear',
      navUpdates: 'Novedades',
    },
    phoneSpotter: {
      badge: 'SPOTTER',
      sectionLabel: 'Verificación comunitaria',
      title: 'Mantén útil la información local.',
      waitingSuffix: 'en espera',
      reviewQueue: 'Cola de revisión',
      queueBusy: 'Hay actualizaciones que necesitan revisión de un spotter.',
      queueClear: 'Todo al día en tus comunidades.',
      queueNote: 'Verifica solo lo que puedas confirmar en el terreno.',
      reviewCta: 'Revisar información',
      whyTitle: 'Por qué importa',
      whyBody: 'Una verificación local hace que cada actualización sea más útil para todos los visitantes.',
    },
    how: {
      eyebrow: 'Elige tu camino',
      title: 'Tres roles. Un Caribe conectado.',
      lede: 'Cada rol fortalece el mismo ciclo local dondequiera que Guaca crece: las preguntas se convierten en actualizaciones verificadas, y las actualizaciones útiles, en mejores días.',
      joinAsPrefix: 'Únete como ',
    },
    roles: {
      tourist: {
        title: 'Turista',
        description: 'Planifica tu día con información local actual y vive cada comunidad caribeña como alguien que la conoce.',
      },
      spotter: {
        title: 'Spotter',
        description: 'Comparte lo que pasa cerca, ayuda a tu comunidad y desbloquea recompensas locales útiles.',
      },
      operator: {
        title: 'Negocio',
        description: 'Sé visible cuando locales y viajeros buscan activamente lo que ofreces.',
      },
    },
    live: {
      eyebrow: 'Información en vivo en la que puedes confiar',
      titleTop: 'Actualizaciones reales de',
      titleScript: 'gente real.',
      lede: 'De horarios de lanchas a condiciones de playa, Guaca muestra qué está pasando ahora y quién lo verificó.',
      features: ['Verificado localmente', 'Actualizado ahora', 'Mapeado en vivo', 'Liderado por la comunidad'],
      mapBadge: 'El Caribe, en vivo',
      emptyTitle: 'La cobertura abre comunidad por comunidad',
      emptyBody: 'Las actualizaciones de negocios aparecen aquí en cuanto se publican.',
    },
    spotters: {
      eyebrow: 'El corazón de Guaca',
      title: 'Los Spotters mantienen vivo el mapa.',
      lede: 'El conocimiento local merece reconocimiento. Las misiones convierten preguntas sin respuesta de viajeros en trabajo comunitario pagado y visible.',
      cta: 'Únete como Spotter',
      card1: 'Misiones con recompensas claras',
      card2: 'Recompensas que reconocen impacto real',
      card2Sub: 'Equipo, insignias, experiencias locales',
    },
    waitlist: {
      eyebrow: 'Únete a las primeras comunidades',
      title: 'Ayuda a decidir dónde crece Guaca.',
      lede: 'Cuéntanos tu rol y la comunidad caribeña que te importa. Usaremos la lista de espera para priorizar demanda local real, no para fingir que toda la región ya está cubierta.',
      steps: ['Elige tu rol', 'Nombra tu comunidad', 'Te avisamos cuando la cobertura esté lista'],
      cardLede: 'La lista de espera funciona con un formulario corto: tu rol, tu comunidad, un minuto.',
      cardCta: 'Abrir el formulario',
      cardNote: 'Se abre en Google Forms',
    },
    businesses: {
      title: '¿Quieres ver cómo funciona el producto?',
      lede: 'Las experiencias de turista, spotter y negocio están casi listas — se abren a medida que crece la cobertura comunitaria.',
      comingSoon: 'Vista previa muy pronto',
    },
    footer: 'El Caribe, mapeado por la gente que lo conoce.',
    deleteAccount: {
      title: 'Eliminar tu cuenta',
      lede: 'Inicia sesión con tu código de correo y confirma. Tu correo — el único dato personal que guardamos — se elimina de inmediato y para siempre.',
      emailLabel: 'El correo de tu cuenta',
      sendCode: 'Enviarme un código',
      codeLabel: 'Código de 6 dígitos',
      verify: 'Continuar',
      confirmTitle: '¿Eliminar esta cuenta?',
      confirmBody: 'Esto elimina tu correo y tu acceso permanentemente. Las preguntas que hiciste quedan en el mapa como demanda anónima — nunca estuvieron ligadas a tu nombre.',
      confirmCta: 'Eliminar mi cuenta',
      done: 'Tu cuenta fue eliminada. Gracias por viajar con locales.',
      error: 'Falló la conexión — intenta de nuevo.',
      badCode: 'Código incorrecto o vencido — intenta de nuevo.',
    },
  },
}
