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
    devBypassCta: string
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
    devCodeHint: string
    devBypassCta: string
    emailLabel: string
    sendCodeCta: string
    codeSentTo: string
    codeLabel: string
    loginCta: string
    changeEmail: string
    notRegistered: string
    loginFailed: string
    tabMissions: string
    tabMap: string
    tabConfirm: string
    tabEarnings: string
    mapLede: string
    rankingTitle: string
    monthPoints: string
    rankLabel: string
    historyTitle: string
    pointsSuffix: string
    storeTitle: string
    storeNote: string
    storeRedeem: string
    becomeTourist: string
    becomeTouristNote: string
    levelProgress: string
    levelMax: string
    myPinsTitle: string
    myPinsEmpty: string
    qualityTitle: string
    qualityVerified: string
    qualityRejected: string
    qualityAwaiting: string
    qualityConfirmed: string
    qualityFirstPass: string
    photoCta: string
    photoBusy: string
    zoneLabel: string
    contactOperator: string
    signOut: string
    deleteNote: string
    legalPrivacy: string
    legalTerms: string
    mapEmpty: string
    legendMissions: string
    legendConfirm: string
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
    freeCta: string
    freeTitle: string
    freeLede: string
    categoryLabel: string
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
    confirmTooFar: string
    geoDenied: string
    alreadyDecided: string
    reasons: Record<string, string>
  }
  install: {
    cta: string
    note: string
    iosTitle: string
    iosBody: string
    installed: string
  }
  business: {
    badge: string
    title: string
    lede: string
    points: string[]
    registerCta: string
    registerNote: string
    backCta: string
    devPreview: string
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
    tabMap: string
    tabGuaca: string
    tabPlan: string
    tabProfile: string
    guacaTitle: string
    guacaLede: string
    guacaPlaceholder: string
    guacaEmptyTitle: string
    guacaEmptyBody: string
    guacaSuggestions: string[]
    guacaClear: string
    planTitle: string
    planLede: string
    planEmptyTitle: string
    planEmptyBody: string
    planEmptyCta: string
    planFromQuestion: string
    planViewOnMap: string
    planClear: string
    tripsTitle: string
    tripsLede: string
    tripsEmpty: string
    tripDaysLabel: string
    tripPaceLabel: string
    paceRelaxed: string
    paceBalanced: string
    pacePacked: string
    planTripCta: string
    tripPlanning: string
    tripDay: string
    tripShare: string
    tripDelete: string
    tripRefused: string
    suggestionsTitle: string
    whyTrending: string
    whyAskedAbout: string
    whyFresh: string
    trendChip: string
    countryLive: string
    countryPlanned: string
    countryUncovered: string
    pickerTitle: string
    pickerVerified: string
    pickerCandidates: string
    pickerNoAreas: string
    pickerExplore: string
    pickerShowAll: string
    pickerNearMe: string
    pickerSearch: string
    zoneDemandTitle: string
    zoneDemandAsks: string
    personAsking: string
    peopleAsking: string
    profileTitle: string
    profileGuestOf: string
    profileLanguage: string
    profileUpdates: string
    profileBecomeSpotter: string
    profileBecomeSpotterNote: string
    profileSignOut: string
    profileDelete: string
    profileDeleteNote: string
    sheetDirections: string
    sheetAsk: string
    sheetShare: string
    sheetDoubt: string
    sheetDoubtSent: string
    askAboutPlace: string
    refusalNotify: string
    refusalNotifySaved: string
    refusalCoverage: string
    refusalCoverageNone: string
    refusalOffer: string
    refusalUnclear: string
    refusalMission: string
    refusalMissionSending: string
    refusalMissionSent: string
    refusalMissionOpen: string
    refusalMissionBudget: string
    refusalMissionNoSpotter: string
    refusalMissionFailed: string
    addToPlan: string
    addedToPlan: string
    removeStop: string
    sharePlan: string
    shareVia: string
    categoryLabels: Record<string, string>
    allCategories: string
    postsTitle: string
    postsEmpty: string
    postsPlaceholder: string
    postsLinkPlaceholder: string
    postsSend: string
    postsTraveler: string
    postsWatch: string
    postsVisited: string
    postsRatingHint: string
    postsError: string
    postsReport: string
    postsReported: string
    updatesTitle: string
    updatesLede: string
    updatesEmpty: string
    updatesEmptySearch: string
    updatesSearch: string
    updatesVerifiedBy: string
    updatesPublished: string
    favSave: string
    favSaved: string
    favTitle: string
    favEmpty: string
    candidateTitle: string
    candidateBody: string
    candidateCta: string
    candidateAsk: string
    offline: string
    geoTitle: string
    geoBody: string
    geoAllow: string
    geoSkip: string
    impactTitle: string
    impactAsked: string
    impactCommissioned: string
    impactVerified: string
    impactNote: string
    watchingTitle: string
    watchingEmpty: string
    watchingCancel: string
    myPostsTitle: string
    myPostsEmpty: string
    villaCodeLabel: string
    villaCodeCta: string
    villaCodeBad: string
    legalPrivacy: string
    legalTerms: string
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
      devBypassCta: '⚡ Dev bypass — skip sign-in',
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
      gateLede: 'Enter the email your operator registered. We send a one-time code each time. No self-signup: every Spotter is invited.',
      devCodeHint: 'Dev build: any roster email signs in with code 000000.',
      devBypassCta: '⚡ Dev bypass: enter as Yorman Salazar [DEV]',
      emailLabel: 'Your email',
      sendCodeCta: 'Send me a code',
      codeSentTo: 'We sent a 6-digit code to',
      codeLabel: '6-digit code',
      loginCta: 'Enter',
      changeEmail: 'Use another email',
      notRegistered: 'This email is not on the Spotter roster. Ask your operator to add you.',
      loginFailed: 'Code not recognised. Codes last 10 minutes and work once; request a new one.',
      tabMissions: 'Missions',
      tabMap: 'Map',
      tabConfirm: 'Confirm',
      tabEarnings: 'Profile',
      mapLede: 'Your earning opportunities, where you are.',
      mapEmpty: 'No opportunities near you right now — they appear when travellers ask about unverified places.',
      legendMissions: 'Missions',
      legendConfirm: 'To confirm',
      missionsTitle: 'Your missions',
      missionsEmpty: 'No missions yet — they arrive when travellers ask about places nobody has verified.',
      acceptCta: 'Accept mission',
      startCta: 'I am there — verify it',
      statusOffered: 'Offered',
      statusAccepted: 'Accepted',
      statusSubmitted: 'In verification',
      statusVerified: 'Verified',
      statusPaid: 'Paid',
      reward: 'Points',
      captureTitle: 'Verify the place',
      freeCta: 'Verify a place here',
      freeTitle: 'A place you found',
      freeLede: 'Not from a mission — you are here and it is worth being on the map. Same checks, same second local.',
      categoryLabel: 'What kind of place is it?',
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
      earningsTitle: 'Your profile',
      rankingTitle: "This month's ranking",
      monthPoints: 'Points this month',
      rankLabel: 'Rank',
      historyTitle: 'Points history',
      pointsSuffix: 'pts',
      storeTitle: 'Points store',
      storeNote: 'Redemptions launch after the pilot — keep earning.',
      storeRedeem: 'Redeem',
      becomeTourist: 'Change to Tourist mode',
      becomeTouristNote: 'Explore the map and plan with Guaca AI.',
      levelProgress: 'to level',
      levelMax: 'Top level reached',
      myPinsTitle: 'Pins with your name',
      myPinsEmpty: 'Verify a place and it appears here, with your name on the pin.',
      qualityTitle: 'Your record',
      qualityVerified: 'Verified',
      qualityRejected: 'Rejected',
      qualityAwaiting: 'In checks',
      qualityConfirmed: 'Confirmed for others',
      qualityFirstPass: 'first-pass rate',
      photoCta: 'Change photo',
      photoBusy: 'Uploading…',
      zoneLabel: 'Zone',
      contactOperator: 'Contact your operator',
      signOut: 'Sign out',
      deleteNote: 'To delete your Spotter account, write to hola@guaca.live from your registered number.',
      legalPrivacy: 'Privacy',
      legalTerms: 'Terms',
      earningsEmpty: 'Completed missions and their points appear here.',
      backCta: 'Back',
      error: 'Connection failed — try again.',
      confirmPending: 'This place is still in checks — it unlocks for confirmation once they pass.',
      confirmTooFar: 'You have to be at the place to confirm it — turn on location and try again there.',
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
    install: {
      cta: 'Install Guaca',
      note: 'Adds it to your home screen — no app store needed.',
      iosTitle: 'Install on iPhone',
      iosBody: 'Tap the Share button in Safari, then "Add to Home Screen".',
      installed: 'Installed',
    },
    business: {
      badge: 'Coming soon',
      title: 'Guaca for businesses',
      lede: 'Posadas, restaurants and tour operators will be able to publish what changed today — and have a local Spotter verify it in person.',
      points: [
        'Publish opening hours, prices and closures that travellers see the same day',
        'A named local verifies it on the ground, so your update carries the same badge as the map',
        'A printed QR in your lobby connects your guests to the map — and to you',
      ],
      registerCta: 'Tell us about your business',
      registerNote: 'A short form. We onboard businesses one by one during the Puerto Cabello pilot.',
      backCta: 'Back to the map',
      devPreview: 'Dev build — preview the publisher',
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
      tabMap: 'Map',
      tabGuaca: 'Guaca',
      tabPlan: 'Plan',
      tabProfile: 'Profile',
      guacaTitle: 'Guaca AI',
      guacaLede: 'Plans and answers built only from places locals have physically verified. When nobody has checked, Guaca says so — and sends a local.',
      guacaPlaceholder: 'Plan my day, find a beach…',
      guacaEmptyTitle: 'Ask anything about this coast',
      guacaEmptyBody: 'Every recommendation is backed by a named local who stood there. No inventions, ever.',
      guacaSuggestions: [
        'Plan my day near the malecón',
        'Where can I eat arepas nearby?',
        'Which beach is best this afternoon?',
      ],
      guacaClear: 'Clear conversation',
      planTitle: 'Your plan',
      planLede: 'The latest plan Guaca built for you — every stop physically verified.',
      planEmptyTitle: 'No plan yet',
      planEmptyBody: 'Ask Guaca to plan your day and the itinerary will live here.',
      planEmptyCta: 'Plan my day with Guaca',
      planFromQuestion: 'From your question',
      planViewOnMap: 'View on map',
      planClear: 'Clear plan',
      tripsTitle: 'Saved trips',
      tripsLede: 'Multi-day trips Guaca planned for you — shareable with anyone.',
      tripsEmpty: 'No trips yet — plan one below.',
      tripDaysLabel: 'Days',
      tripPaceLabel: 'Pace',
      paceRelaxed: 'Relaxed',
      paceBalanced: 'Balanced',
      pacePacked: 'Packed',
      planTripCta: 'Plan this trip',
      tripPlanning: 'Planning…',
      tripDay: 'Day',
      tripShare: 'Share trip',
      tripDelete: 'Delete trip',
      tripRefused: 'Not enough verified ground for that trip yet — a local has been asked to go look.',
      suggestionsTitle: 'Worth a look',
      whyTrending: 'Trending',
      whyAskedAbout: 'People are asking about this',
      whyFresh: 'Fresh on the map',
      trendChip: 'Trending',
      countryLive: 'Pilot live',
      countryPlanned: 'Expansion target',
      countryUncovered: 'Not covered yet',
      pickerTitle: 'Choose where to look',
      pickerVerified: 'verified',
      pickerCandidates: 'unverified candidates',
      pickerNoAreas: 'No areas yet — ask a question there and coverage starts',
      pickerExplore: 'Explore the Caribbean',
      pickerShowAll: 'Show all countries',
      pickerNearMe: 'Near me',
      pickerSearch: 'Search country or zone…',
      zoneDemandTitle: 'Where people are asking',
      zoneDemandAsks: 'asks',
      personAsking: 'person asking here',
      peopleAsking: 'people asking here',
      profileTitle: 'Profile',
      profileGuestOf: 'Guest of',
      profileLanguage: 'Language',
      profileUpdates: 'Local updates',
      profileBecomeSpotter: 'Change to Spotter mode',
      profileBecomeSpotterNote: 'Verify places in your community — earn points and rewards.',
      profileSignOut: 'Sign out',
      profileDelete: 'Delete my account',
      profileDeleteNote: 'Removes your email — your anonymous questions stay as map demand.',
      sheetDirections: 'Take me there',
      sheetAsk: 'Ask Guaca',
      sheetShare: 'Share',
      sheetDoubt: 'Still accurate?',
      sheetDoubtSent: 'A local will re-check it',
      askAboutPlace: 'Tell me about {name} — is it still open and worth visiting?',
      refusalNotify: 'Tell me when it’s verified',
      refusalNotifySaved: 'We’ll email you when a local verifies it',
      refusalCoverage: 'Locals have verified {n} places within 5 km, {c} of them {category}. Nothing matching this has been checked yet.',
      refusalCoverageNone: 'Locals have verified {n} places within 5 km, none of them {category} yet.',
      refusalOffer: 'Want one of these instead?',
      refusalUnclear: 'I did not catch what kind of place you are after. Here is what locals have verified nearby:',
      refusalMission: 'Send a local to check',
      refusalMissionSending: 'Finding a local…',
      refusalMissionSent: '{name} has been sent. Expect an answer within {hours} h; we’ll email you.',
      refusalMissionOpen: 'A local is already on it ({name}, until {when}). We’ll email you.',
      refusalMissionBudget: 'Today’s missions are all assigned. Your question stays in line; we’ll email you.',
      refusalMissionNoSpotter: 'No Spotter covers this zone yet. Your question is saved; we’ll email you when one does.',
      refusalMissionFailed: 'Could not send a local right now. Your question is saved.',
      addToPlan: 'Add to plan',
      addedToPlan: 'In your plan',
      removeStop: 'Remove stop',
      sharePlan: 'Share plan',
      shareVia: 'Verified by locals on Guaca',
      categoryLabels: {
        eat_drink: 'Eat & drink',
        beach_water: 'Beaches',
        nature_walk: 'Nature',
        culture_history: 'Culture',
        market_shop: 'Markets',
        services: 'Services',
        nightlife_music: 'Music & nightlife',
        practical: 'Practical',
      },
      allCategories: 'All',
      postsTitle: 'What locals say',
      postsEmpty: 'No posts yet — be the first.',
      postsPlaceholder: 'Share a tip about this place…',
      postsLinkPlaceholder: 'Reel / TikTok link (optional)',
      postsSend: 'Post',
      postsTraveler: 'Traveler',
      postsWatch: 'Watch video',
      postsVisited: 'Visited',
      postsRatingHint: 'Stars only count when you post from the place.',
      postsError: 'Could not post — links must be TikTok, Instagram, YouTube or Facebook.',
      postsReport: 'Report',
      postsReported: 'Reported',
      updatesTitle: 'Local updates',
      updatesLede: 'Pilot preview: businesses will publish current information here. Nothing is verified until a Spotter checks it in person.',
      updatesEmpty: 'No business updates yet.',
      updatesEmptySearch: 'No updates match your search.',
      updatesSearch: 'Search businesses, places, or updates',
      updatesVerifiedBy: 'Verified by',
      updatesPublished: 'Business-published',
      favSave: 'Save',
      favSaved: 'Saved',
      favTitle: 'Saved places',
      favEmpty: 'Tap ♥ on any place to keep it here.',
      candidateTitle: 'Not verified yet',
      candidateBody: 'This spot is on OpenStreetMap, but no local has physically checked it. Ask Guaca and your question can send a paid Spotter.',
      candidateCta: 'Ask Guaca about it',
      candidateAsk: 'Is {name} open and worth visiting?',
      offline: 'Can’t reach Guaca — check your connection.',
      geoTitle: 'Use your location?',
      geoBody: 'Guaca uses your location while the app is open to show verified places near you and to build plans around where you are. It is never shared or used for ads. You can say no and browse the pilot area instead.',
      geoAllow: 'Use my location',
      geoSkip: 'Not now',
      impactTitle: 'Your impact',
      impactAsked: 'Questions asked',
      impactCommissioned: 'Locals sent to check',
      impactVerified: 'Verified for you',
      impactNote: 'Your questions are anonymous — these counts live on this device.',
      watchingTitle: 'Waiting on a local',
      watchingEmpty: 'When Guaca refuses, ask to be told once a local verifies it.',
      watchingCancel: 'Stop waiting',
      myPostsTitle: 'Your posts',
      myPostsEmpty: 'Tips you share about places appear here.',
      villaCodeLabel: 'Villa or posada code',
      villaCodeCta: 'Link my stay',
      villaCodeBad: 'That code is not active.',
      legalPrivacy: 'Privacy policy',
      legalTerms: 'Terms of use',
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
      devBypassCta: '⚡ Bypass dev — saltar el registro',
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
      gateLede: 'Escribe el correo que registró tu operador. Te enviamos un código de un solo uso cada vez. No hay registro abierto: cada Spotter es invitado.',
      devCodeHint: 'Versión de desarrollo: cualquier correo del roster entra con el código 000000.',
      devBypassCta: '⚡ Bypass dev: entrar como Yorman Salazar [DEV]',
      emailLabel: 'Tu correo',
      sendCodeCta: 'Enviarme un código',
      codeSentTo: 'Enviamos un código de 6 dígitos a',
      codeLabel: 'Código de 6 dígitos',
      loginCta: 'Entrar',
      changeEmail: 'Usar otro correo',
      notRegistered: 'Este correo no está en el roster de Spotters. Pide a tu operador que te añada.',
      loginFailed: 'Código no reconocido. Los códigos duran 10 minutos y sirven una vez; pide uno nuevo.',
      tabMissions: 'Misiones',
      tabMap: 'Mapa',
      mapLede: 'Tus oportunidades de ganar, donde estás.',
      mapEmpty: 'No hay oportunidades cerca por ahora — aparecen cuando los viajeros preguntan por lugares sin verificar.',
      legendMissions: 'Misiones',
      legendConfirm: 'Por confirmar',
      tabConfirm: 'Confirmar',
      tabEarnings: 'Perfil',
      missionsTitle: 'Tus misiones',
      missionsEmpty: 'Sin misiones todavía — llegan cuando los viajeros preguntan por lugares que nadie ha verificado.',
      acceptCta: 'Aceptar misión',
      startCta: 'Estoy aquí — verificarlo',
      statusOffered: 'Ofrecida',
      statusAccepted: 'Aceptada',
      statusSubmitted: 'En verificación',
      statusVerified: 'Verificada',
      statusPaid: 'Pagada',
      reward: 'Puntos',
      captureTitle: 'Verifica el lugar',
      freeCta: 'Verificar un lugar aquí',
      freeTitle: 'Un lugar que encontraste',
      freeLede: 'No viene de una misión — estás aquí y merece estar en el mapa. Las mismas comprobaciones, el mismo segundo local.',
      categoryLabel: '¿Qué tipo de lugar es?',
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
      earningsTitle: 'Tu perfil',
      rankingTitle: 'Ranking del mes',
      monthPoints: 'Puntos este mes',
      rankLabel: 'Puesto',
      historyTitle: 'Historial de puntos',
      pointsSuffix: 'pts',
      storeTitle: 'Tienda de puntos',
      storeNote: 'Los canjes llegan después del piloto — sigue sumando.',
      storeRedeem: 'Canjear',
      becomeTourist: 'Cambiar a modo Turista',
      becomeTouristNote: 'Explora el mapa y planifica con Guaca AI.',
      levelProgress: 'para el nivel',
      levelMax: 'Nivel máximo alcanzado',
      myPinsTitle: 'Pines con tu nombre',
      myPinsEmpty: 'Verifica un lugar y aparecerá aquí, con tu nombre en el pin.',
      qualityTitle: 'Tu récord',
      qualityVerified: 'Verificados',
      qualityRejected: 'Rechazados',
      qualityAwaiting: 'En revisión',
      qualityConfirmed: 'Confirmados a otros',
      qualityFirstPass: 'aprobados a la primera',
      photoCta: 'Cambiar foto',
      photoBusy: 'Subiendo…',
      zoneLabel: 'Zona',
      contactOperator: 'Contactar a tu operador',
      signOut: 'Cerrar sesión',
      deleteNote: 'Para eliminar tu cuenta de Spotter, escribe a hola@guaca.live desde tu número registrado.',
      legalPrivacy: 'Privacidad',
      legalTerms: 'Términos',
      earningsEmpty: 'Las misiones completadas y sus puntos aparecen aquí.',
      backCta: 'Volver',
      error: 'Falló la conexión — intenta de nuevo.',
      confirmPending: 'Este lugar sigue en chequeos — se desbloquea para confirmar cuando pasen.',
      confirmTooFar: 'Tienes que estar en el lugar para confirmarlo — activa la ubicación e inténtalo allí.',
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
    install: {
      cta: 'Instalar Guaca',
      note: 'Se agrega a tu pantalla de inicio — sin tienda de apps.',
      iosTitle: 'Instalar en iPhone',
      iosBody: 'Toca el botón Compartir en Safari y luego «Agregar a inicio».',
      installed: 'Instalada',
    },
    business: {
      badge: 'Muy pronto',
      title: 'Guaca para negocios',
      lede: 'Posadas, restaurantes y operadores turísticos podrán publicar lo que cambió hoy — y que un Spotter local lo verifique en persona.',
      points: [
        'Publica horarios, precios y cierres que los viajeros ven el mismo día',
        'Un local con nombre lo verifica en el terreno, así tu novedad lleva el mismo sello que el mapa',
        'Un QR impreso en tu recepción conecta a tus huéspedes con el mapa — y contigo',
      ],
      registerCta: 'Cuéntanos de tu negocio',
      registerNote: 'Un formulario corto. Incorporamos negocios uno por uno durante el piloto de Puerto Cabello.',
      backCta: 'Volver al mapa',
      devPreview: 'Versión de desarrollo — ver el publicador',
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
      tabMap: 'Mapa',
      tabGuaca: 'Guaca',
      tabPlan: 'Plan',
      tabProfile: 'Perfil',
      guacaTitle: 'Guaca AI',
      guacaLede: 'Planes y respuestas construidos solo con lugares que locales verificaron físicamente. Si nadie lo ha comprobado, Guaca lo dice — y envía a un local.',
      guacaPlaceholder: 'Planifica mi día, busca una playa…',
      guacaEmptyTitle: 'Pregunta lo que sea sobre esta costa',
      guacaEmptyBody: 'Cada recomendación está respaldada por un local con nombre que estuvo allí. Nunca inventamos.',
      guacaSuggestions: [
        'Planifica mi día cerca del malecón',
        '¿Dónde puedo comer arepas cerca?',
        '¿Qué playa es mejor esta tarde?',
      ],
      guacaClear: 'Borrar conversación',
      planTitle: 'Tu plan',
      planLede: 'El último plan que Guaca armó para ti — cada parada verificada físicamente.',
      planEmptyTitle: 'Aún no hay plan',
      planEmptyBody: 'Pídele a Guaca que planifique tu día y el itinerario vivirá aquí.',
      planEmptyCta: 'Planificar mi día con Guaca',
      planFromQuestion: 'De tu pregunta',
      planViewOnMap: 'Ver en el mapa',
      planClear: 'Borrar plan',
      tripsTitle: 'Viajes guardados',
      tripsLede: 'Viajes de varios días que Guaca planificó para ti — compartibles con cualquiera.',
      tripsEmpty: 'Aún no hay viajes — planifica uno aquí abajo.',
      tripDaysLabel: 'Días',
      tripPaceLabel: 'Ritmo',
      paceRelaxed: 'Relajado',
      paceBalanced: 'Equilibrado',
      pacePacked: 'Intenso',
      planTripCta: 'Planificar este viaje',
      tripPlanning: 'Planificando…',
      tripDay: 'Día',
      tripShare: 'Compartir viaje',
      tripDelete: 'Eliminar viaje',
      tripRefused: 'Aún no hay terreno verificado para ese viaje — ya le pedimos a un local que vaya a mirar.',
      suggestionsTitle: 'Vale la pena ver',
      whyTrending: 'En tendencia',
      whyAskedAbout: 'La gente pregunta por esto',
      whyFresh: 'Nuevo en el mapa',
      trendChip: 'Tendencia',
      countryLive: 'Piloto activo',
      countryPlanned: 'Próxima expansión',
      countryUncovered: 'Sin cobertura aún',
      pickerTitle: 'Elige dónde mirar',
      pickerVerified: 'verificados',
      pickerCandidates: 'candidatos sin verificar',
      pickerNoAreas: 'Aún sin áreas — pregunta ahí y la cobertura empieza',
      pickerExplore: 'Explora el Caribe',
      pickerShowAll: 'Ver todos los países',
      pickerNearMe: 'Cerca de mí',
      pickerSearch: 'Busca país o zona…',
      zoneDemandTitle: 'Dónde pregunta la gente',
      zoneDemandAsks: 'preguntas',
      personAsking: 'persona preguntando aquí',
      peopleAsking: 'personas preguntando aquí',
      profileTitle: 'Perfil',
      profileGuestOf: 'Huésped de',
      profileLanguage: 'Idioma',
      profileUpdates: 'Novedades locales',
      profileBecomeSpotter: 'Cambiar a modo Spotter',
      profileBecomeSpotterNote: 'Verifica lugares de tu comunidad — gana puntos y recompensas.',
      profileSignOut: 'Cerrar sesión',
      profileDelete: 'Eliminar mi cuenta',
      profileDeleteNote: 'Elimina tu correo — tus preguntas anónimas quedan como demanda del mapa.',
      sheetDirections: 'Llévame allí',
      sheetAsk: 'Pregunta a Guaca',
      sheetShare: 'Compartir',
      sheetDoubt: '¿Sigue siendo así?',
      sheetDoubtSent: 'Un local lo va a re-verificar',
      askAboutPlace: 'Cuéntame de {name} — ¿sigue abierto y vale la pena?',
      refusalNotify: 'Avísame cuando esté verificado',
      refusalNotifySaved: 'Te enviaremos un correo cuando un local lo verifique',
      refusalCoverage: 'Locales han verificado {n} lugares a menos de 5 km, {c} de ellos {category}. Nada que coincida con esto ha sido revisado aún.',
      refusalCoverageNone: 'Locales han verificado {n} lugares a menos de 5 km, ninguno de {category} todavía.',
      refusalOffer: '¿Prefieres alguno de estos?',
      refusalUnclear: 'No entendí qué tipo de lugar buscas. Esto es lo que los locales han verificado cerca:',
      refusalMission: 'Enviar a un local a revisar',
      refusalMissionSending: 'Buscando un local…',
      refusalMissionSent: '{name} ya fue enviado. Espera una respuesta en {hours} h; te avisamos por correo.',
      refusalMissionOpen: 'Un local ya está en eso ({name}, hasta {when}). Te avisamos por correo.',
      refusalMissionBudget: 'Las misiones de hoy ya están asignadas. Tu pregunta sigue en fila; te avisamos por correo.',
      refusalMissionNoSpotter: 'Ningún Spotter cubre esta zona todavía. Guardamos tu pregunta; te avisamos cuando haya uno.',
      refusalMissionFailed: 'No pudimos enviar a un local ahora. Tu pregunta quedó guardada.',
      addToPlan: 'Agregar al plan',
      addedToPlan: 'En tu plan',
      removeStop: 'Quitar parada',
      sharePlan: 'Compartir plan',
      shareVia: 'Verificado por locales en Guaca',
      categoryLabels: {
        eat_drink: 'Comer y beber',
        beach_water: 'Playas',
        nature_walk: 'Naturaleza',
        culture_history: 'Cultura',
        market_shop: 'Mercados',
        services: 'Servicios',
        nightlife_music: 'Música y vida nocturna',
        practical: 'Prácticos',
      },
      allCategories: 'Todo',
      postsTitle: 'Lo que dice la gente',
      postsEmpty: 'Aún no hay publicaciones — sé la primera persona.',
      postsPlaceholder: 'Comparte un dato de este lugar…',
      postsLinkPlaceholder: 'Enlace de Reel / TikTok (opcional)',
      postsSend: 'Publicar',
      postsTraveler: 'Viajero',
      postsWatch: 'Ver video',
      postsVisited: 'Estuvo aquí',
      postsRatingHint: 'Las estrellas solo cuentan si publicas desde el lugar.',
      postsError: 'No se pudo publicar — los enlaces deben ser de TikTok, Instagram, YouTube o Facebook.',
      postsReport: 'Reportar',
      postsReported: 'Reportado',
      updatesTitle: 'Novedades locales',
      updatesLede: 'Vista previa del piloto: los negocios publicarán información actual aquí. Nada está verificado hasta que un Spotter lo compruebe en persona.',
      updatesEmpty: 'Todavía no hay novedades de negocios.',
      updatesEmptySearch: 'Ninguna novedad coincide con tu búsqueda.',
      updatesSearch: 'Buscar negocios, lugares o novedades',
      updatesVerifiedBy: 'Verificado por',
      updatesPublished: 'Publicado por el negocio',
      favSave: 'Guardar',
      favSaved: 'Guardado',
      favTitle: 'Lugares guardados',
      favEmpty: 'Toca ♥ en cualquier lugar para tenerlo aquí.',
      candidateTitle: 'Aún sin verificar',
      candidateBody: 'Este punto está en OpenStreetMap, pero ningún local lo ha comprobado físicamente. Pregúntale a Guaca y tu pregunta puede enviar a un Spotter pagado.',
      candidateCta: 'Pregúntale a Guaca',
      candidateAsk: '¿{name} está abierto y vale la pena?',
      offline: 'No se puede conectar con Guaca — revisa tu conexión.',
      geoTitle: '¿Usar tu ubicación?',
      geoBody: 'Guaca usa tu ubicación mientras la app está abierta para mostrarte lugares verificados cerca y armar planes desde donde estás. Nunca se comparte ni se usa para publicidad. Puedes decir que no y explorar la zona piloto.',
      geoAllow: 'Usar mi ubicación',
      geoSkip: 'Ahora no',
      impactTitle: 'Tu impacto',
      impactAsked: 'Preguntas hechas',
      impactCommissioned: 'Locales enviados a comprobar',
      impactVerified: 'Verificados para ti',
      impactNote: 'Tus preguntas son anónimas — estos números viven en este dispositivo.',
      watchingTitle: 'Esperando a un local',
      watchingEmpty: 'Cuando Guaca no sepa, pide que te avisen al verificarlo.',
      watchingCancel: 'Dejar de esperar',
      myPostsTitle: 'Tus publicaciones',
      myPostsEmpty: 'Los datos que compartes sobre lugares aparecen aquí.',
      villaCodeLabel: 'Código de villa o posada',
      villaCodeCta: 'Vincular mi estadía',
      villaCodeBad: 'Ese código no está activo.',
      legalPrivacy: 'Política de privacidad',
      legalTerms: 'Términos de uso',
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
