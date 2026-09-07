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
    mapEmptyCandidates: string
    legendMissions: string
    legendConfirm: string
    legendHeat: string
    filterAll: string
    filterAvailable: string
    filterMine: string
    filterWitness: string
    filterDone: string
    filterHours: string
    filterAccess: string
    filterPhoto: string
    filterFirst: string
    spotHereCta: string
    cityPilot: string
    askPlaceholder: string
    askSend: string
    askChipBreakfast: string
    askChipWitness: string
    askChipNearby: string
    askError: string
    taskHours: string
    taskAccess: string
    taskEvidence: string
    taskWitness: string
    taskDone: string
    previewDistance: string
    unverifiedInvite: string
    confirmMissionCta: string
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
    close: string
    candidatesLegend: string
    candidatesNudgeTitle: (n: number) => string
    candidatesNudgeBody: string
    candidatesNudgeCta: string
    candidateTitle: string
    candidateBody: string
    candidateCta: string
    candidatePublic: string
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
    statusExpired: string
    statusCancelled: string
    deadlineLabel: string
    placeLabel: string
    evidenceLabel: string
    evidenceDefault: string
    openMissionsTitle: string
    inProgressTitle: string
    completedTitle: string
    mainMission: string
    altMission: string
    awaitingSecond: string
    awaitingSecondNote: string
    expiredNote: string
    uploadFailed: string
    duplicateEvidence: string
    locationDenied: string
    missionExpired: string
    catalogEmpty: string
    catalogSandbox: string
    redeeming: string
    redeemDisabled: string
    redeemReceipt: string
    redeemDone: string
    alreadyRedeemed: string
    ledgerTitle: string
    ledgerEmpty: string
    pointsNotMoney: string
    checksPassed: string
    checksTitle: string
    badgesTitle: string
    badgeNone: string
    badgeFirstPin: string
    badgeWitness: string
    badgeSteady: string
    scenarioHint: string
    luciaCta: string
    andresCta: string
    confirmOtherAccount: string
    rewardCredited: string
    insufficientPoints: string
    reasons: Record<string, string>
  }
  merchant: {
    gateTitle: string
    gateLede: string
    emailLabel: string
    sendCodeCta: string
    codeSentTo: string
    codeLabel: string
    loginCta: string
    changeEmail: string
    loginFailed: string
    notRegistered: string
    error: string
    devCodeHint: string
    devBypassCta: string
    tabToday: string
    tabReservations: string
    tabPlace: string
    tabVisibility: string
    todayTitle: string
    todayLede: string
    todayEmpty: string
    todayPending: (n: number) => string
    todayOpenInbox: string
    reservationsTitle: string
    reservationsLede: string
    reservationsEmpty: string
    requestStay: string
    awaitingConfirmation: string
    confirmCta: string
    declineCta: string
    declineReason: string
    declineReasonPlaceholder: string
    confirmed: string
    declined: string
    guests: string
    nights: string
    note: string
    reference: string
    holdUntil: string
    statusRequested: string
    statusConfirmed: string
    statusDeclined: string
    statusExpired: string
    statusCancelled: string
    statusCompleted: string
    noPayment: string
    placeTitle: string
    placeLede: string
    roomTypeEn: string
    roomTypeEs: string
    amenities: string
    savePlace: string
    saving: string
    saved: string
    publishTitle: string
    publishLede: string
    publishKind: string
    publishEn: string
    publishEs: string
    publishCta: string
    published: string
    publishedNote: string
    kindSchedule: string
    kindAccess: string
    kindService: string
    kindCondition: string
    visibilityTitle: string
    visibilityLede: string
    licenseActive: string
    licenseExpired: string
    licenseRevoked: string
    visibilityStandard: string
    visibilityPromoted: string
    promotedLabel: string
    licenseNote: string
    signOut: string
    loading: string
    retry: string
    amenityLabels: Record<string, string>
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
    firstEyebrow: Record<string, string>
    checkinGood: string
    checkinNotThere: string
    checkinSkipped: string
    checkinThanks: string
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
    discoverTitle: string
    discoverSub: string
    discoverMore: string
    discoverLess: string
    verifiedBySpotters: string
    coverageTitle: string
    coverageBody: string
    nowSunset: string
    nowRain: string
    nowHoliday: string
    nowSea: Record<'calm' | 'moderate' | 'rough', string>
    nowRates: string
    publicListing: string
    contactConfirmed: string
    callCta: string
    websiteCta: string
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
    tierCorroborated: string
    tierListed: string
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
    discoverPlaces: string
    discoverActivities: string
    discoverStays: string
    interestTitle: string
    interestHint: string
    interestRelax: string
    interestAdventure: string
    interestCulture: string
    interestFood: string
    actTitle: string
    actLede: string
    actEmpty: string
    actLoading: string
    actError: string
    actRetry: string
    actDuration: string
    actWalk: string
    actTaxi: string
    actMixed: string
    actBoat: string
    actMorning: string
    actAfternoon: string
    actSunset: string
    actEvening: string
    actPlaces: string
    actAddPlan: string
    actEstimate: string
    stayTitle: string
    stayLede: string
    stayEmpty: string
    stayLoading: string
    stayError: string
    stayRetry: string
    stayNightly: string
    stayGuestsMax: string
    stayReserve: string
    stayNotBookable: string
    stayPromoted: string
    stayPriceBand: string
    stayBandBudget: string
    stayBandMid: string
    stayBandUpper: string
    stayAmenities: string
    stayAllAmenities: string
    stayCheckIn: string
    stayCheckOut: string
    stayGuests: string
    stayNote: string
    stayNotePlaceholder: string
    stayRequestRoom: string
    stayRequesting: string
    stayPending: string
    stayHoldUntil: string
    stayConfirmed: string
    stayReference: string
    stayDeclined: string
    stayExpired: string
    stayCancelled: string
    stayCompleted: string
    stayCancel: string
    stayCancelling: string
    stayCancelConfirm: string
    stayUnavailable: string
    stayBusyNights: string
    staySuccess: string
    stayErrorForm: string
    stayReview: string
    stayNoPayment: string
    stayNights: string
    stayOpenPlace: string
    amenityWifi: string
    amenityAc: string
    amenityFan: string
    amenityBreakfast: string
    amenityPool: string
    amenityOceanView: string
    amenityRooftop: string
    amenityCourtyard: string
    amenitySharedCourtyard: string
    amenityHammocks: string
    bookTitle: string
    bookEmpty: string
    bookLoading: string
    bookError: string
    bookRetry: string
    bookDirections: string
    bookPrivate: string
    obsTitle: string
    obsEmpty: string
    obsLoading: string
    obsError: string
    obsRetry: string
    obsPublicListing: string
    obsBusinessStatement: string
    obsPendingCheck: string
    obsLocallyConfirmed: string
    obsExpired: string
    obsObserved: string
    obsRequestCheck: string
    obsRequesting: string
    obsRequested: string
    obsNotCurrent: string
    obsKindSchedule: string
    obsKindAccess: string
    obsKindService: string
    obsKindCondition: string
    timelineWalk: string
    timelineTaxi: string
    timelineBoat: string
    timelineSubstitute: string
    timelineDuration: string
    timelineTravel: string
    entitlementTitle: string
    entitlementActive: string
    entitlementExpired: string
    entitlementNone: string
    entitlementNote: string
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
      devBypassCta: 'Explore Puerto Cabello',
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
      mapLede: 'Check hours, access, and places waiting on a local.',
      mapEmpty: 'No opportunities near you right now — they appear when travellers ask about unverified places.',
      mapEmptyCandidates: 'No missions yet. Tap any small badge: open data knows the place, and you can be the first to verify it.',
      legendMissions: 'Missions',
      legendConfirm: 'To confirm',
      legendHeat: 'Popular right now',
      filterAll: 'All work',
      filterAvailable: 'Available',
      filterMine: 'My missions',
      filterWitness: 'Needs a witness',
      filterDone: 'Completed',
      filterHours: 'Hours',
      filterAccess: 'Access',
      filterPhoto: 'Photo',
      filterFirst: 'First visit',
      spotHereCta: "I'm here",
      cityPilot: 'Puerto Cabello',
      askPlaceholder: 'Ask Guaca what to check…',
      askSend: 'Ask Guaca',
      askChipBreakfast: 'Breakfast hours',
      askChipWitness: 'Who needs a second local?',
      askChipNearby: 'What is open to check?',
      askError: 'Guaca could not answer. Try again, or pick a pin on the map.',
      taskHours: 'Hours to check',
      taskAccess: 'Access or conditions',
      taskEvidence: 'Evidence needed',
      taskWitness: 'Second local needed',
      taskDone: 'Completed',
      previewDistance: 'Distance',
      unverifiedInvite: 'Listed, not checked. Open for a first visit.',
      confirmMissionCta: 'Confirm as second local',
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
      close: 'Close',
      candidatesLegend: 'Candidates',
      candidatesNudgeTitle: (n) => `${n} places near you are still unverified`,
      candidatesNudgeBody: 'Open data knows they exist. Nobody has stood in front of them yet. Every one you verify earns points.',
      candidatesNudgeCta: 'Open the map',
      candidateTitle: 'Known to open data, not verified',
      candidateBody: 'Public sources have this listed. Stand here, check it is real, and put it on the map properly.',
      candidateCta: 'Verify this place',
      candidatePublic: 'Public listing',
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
      rankingTitle: 'Ranking',
      monthPoints: 'Points',
      rankLabel: 'Rank',
      historyTitle: 'Points history',
      pointsSuffix: 'pts',
      storeTitle: 'Points store',
      storeNote: 'Sandbox catalog. Redeeming writes a receipt. Nothing is shipped, and points are not money.',
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
      statusExpired: 'Expired',
      statusCancelled: 'Cancelled',
      deadlineLabel: 'Deadline',
      placeLabel: 'Place',
      evidenceLabel: 'Expected evidence',
      evidenceDefault: '3 photos from the place: the entrance, a readable sign, and the street around it.',
      openMissionsTitle: 'Available now',
      inProgressTitle: 'In progress',
      completedTitle: 'Completed history',
      mainMission: 'Main mission',
      altMission: 'Alternative',
      awaitingSecond: 'Awaiting a second local',
      awaitingSecondNote: 'Checks passed. A different Spotter must confirm on the ground. You cannot confirm your own submission.',
      expiredNote: 'This mission expired. It cannot be submitted.',
      uploadFailed: 'Upload failed. Check the connection and try again. Already uploaded photos are kept.',
      duplicateEvidence: 'A photo matches evidence already on file. Use a new photo from this visit.',
      locationDenied: 'Location is required and was denied. Allow location for this site and try again at the place.',
      missionExpired: 'This mission is no longer open.',
      catalogEmpty: 'No sandbox rewards are listed yet.',
      catalogSandbox: 'Sandbox catalog. Redeeming writes a receipt. Nothing is shipped, and points are not money.',
      redeeming: 'Redeeming…',
      redeemDisabled: 'Not enough points yet. Complete a mission to raise your balance.',
      redeemReceipt: 'Receipt',
      redeemDone: 'Redeemed. Your points were deducted and a receipt was written.',
      alreadyRedeemed: 'You already redeemed this reward.',
      ledgerTitle: 'Points ledger',
      ledgerEmpty: 'Ledger events appear here when missions complete or you redeem a reward.',
      pointsNotMoney: 'Points are not money. They never convert to a payout in this app.',
      checksPassed: 'Supported checks passed. Waiting for an independent local.',
      checksTitle: 'Checks on this submission',
      badgesTitle: 'Badges',
      badgeNone: 'Badges appear after verified work on the map.',
      badgeFirstPin: 'First pin',
      badgeWitness: 'Second local',
      badgeSteady: 'Steady record',
      scenarioHint: 'Dev: sign in as a recording Spotter with code 000000.',
      luciaCta: 'Enter as Lucía Castañeda',
      andresCta: 'Enter as Andrés Pardo',
      confirmOtherAccount: 'Confirm from a second Spotter account. The person who submitted cannot be the second local.',
      rewardCredited: 'Mission complete. Points were added to your ledger.',
      insufficientPoints: 'This reward costs more points than you have.',
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
    merchant: {
      gateTitle: 'Host sign in',
      gateLede: 'Enter the email for your stay. We send a one-time code. This workspace is only for the venue you host, not the operator console.',
      emailLabel: 'Your email',
      sendCodeCta: 'Send me a code',
      codeSentTo: 'We sent a 6-digit code to',
      codeLabel: '6-digit code',
      loginCta: 'Enter',
      changeEmail: 'Use another email',
      loginFailed: 'Code not recognised. Codes last 10 minutes and work once; request a new one.',
      notRegistered: 'This email is not a host account.',
      error: 'Connection failed. Try again.',
      devCodeHint: 'Dev build: the code is always 000000.',
      devBypassCta: 'Enter as Elena Vargas',
      tabToday: 'Today',
      tabReservations: 'Reservations',
      tabPlace: 'My place',
      tabVisibility: 'Visibility',
      todayTitle: 'Today at your stay',
      todayLede: 'Requests hold a room until you confirm or decline. No payment is collected here.',
      todayEmpty: 'No stay requests waiting. When a traveller asks for dates, they appear in Reservations.',
      todayPending: (n) => (n === 1 ? '1 stay request waiting' : `${n} stay requests waiting`),
      todayOpenInbox: 'Open reservations',
      reservationsTitle: 'Stay requests',
      reservationsLede: 'Confirm or decline each request. Confirmation is not a payment.',
      reservationsEmpty: 'No stay requests yet.',
      requestStay: 'Request a stay',
      awaitingConfirmation: 'Awaiting confirmation',
      confirmCta: 'Confirm stay',
      declineCta: 'Decline',
      declineReason: 'Reason (optional)',
      declineReasonPlaceholder: 'Dates no longer work, room closed, …',
      confirmed: 'Stay confirmed. The traveller can see the same reservation.',
      declined: 'Request declined. The held nights were released.',
      guests: 'Guests',
      nights: 'Nights',
      note: 'Note',
      reference: 'Reference',
      holdUntil: 'Hold until',
      statusRequested: 'Requested',
      statusConfirmed: 'Confirmed',
      statusDeclined: 'Declined',
      statusExpired: 'Expired',
      statusCancelled: 'Cancelled',
      statusCompleted: 'Completed',
      noPayment: 'Listed nightly rate. No payment is collected in this workspace.',
      placeTitle: 'Your stay',
      placeLede: 'Edit the room and amenities for this scenario listing. A business update never marks the place as locally verified.',
      roomTypeEn: 'Room type (English)',
      roomTypeEs: 'Room type (Spanish)',
      amenities: 'Amenities',
      savePlace: 'Save listing',
      saving: 'Saving…',
      saved: 'Listing saved.',
      publishTitle: 'Publish an update',
      publishLede: 'This is a business statement. Locals still have to confirm it before it reads as locally checked.',
      publishKind: 'What changed',
      publishEn: 'Update in English',
      publishEs: 'Update in Spanish',
      publishCta: 'Publish business update',
      published: 'Update published as a business statement.',
      publishedNote: 'Business statement. Not locally verified.',
      kindSchedule: 'Schedule',
      kindAccess: 'Access',
      kindService: 'Service',
      kindCondition: 'Condition',
      visibilityTitle: 'Zone license',
      visibilityLede: 'License status changes how this stay is shown as a business. It never becomes a local-verification badge.',
      licenseActive: 'Active',
      licenseExpired: 'Expired',
      licenseRevoked: 'Revoked',
      visibilityStandard: 'Standard placement',
      visibilityPromoted: 'Promoted placement',
      promotedLabel: 'Promoted',
      licenseNote: 'A promoted listing is labelled promoted. It is not a locally verified pin and not an unbiased recommendation.',
      signOut: 'Sign out',
      loading: 'Loading…',
      retry: 'Try again',
      amenityLabels: {
        fan: 'Fan',
        shared_courtyard: 'Shared courtyard',
        hammocks: 'Hammocks',
        wifi: 'Wi-Fi',
        ac: 'Air conditioning',
        breakfast: 'Breakfast',
        courtyard: 'Courtyard',
        pool: 'Pool',
        ocean_view: 'Ocean view',
        rooftop: 'Rooftop',
      },
    },
    tourist: {
      askPlaceholder: 'Ask Guaca about a place…',
      asking: 'Checking with the locals…',
      refusalTitle: 'No one has been there yet',
      refusalNote: 'Your question was recorded — it can open a paid Spotter mission.',
      answerTitle: 'Places from the map',
      placesOnMap: 'on the map',
      verifiedBy: 'Physically visited by',
      landmarkLabel: 'How to find it',
      close: 'Close',
      firstEyebrow: { welcome: 'Guaca', rain_replan: 'Guaca moved your day', storm: 'Storm alert', morning_plan: 'Guaca, this morning', evening_checkin: 'How did it go?', stop_verified: 'A local checked', stop_rejected: 'A local checked', next_stop: 'Next stop' },
      checkinGood: 'Good',
      checkinNotThere: 'Not there',
      checkinSkipped: 'Skipped',
      checkinThanks: 'Thanks, that teaches me. "Not there" sends a local to look.',
      askError: 'Couldn’t reach Guaca — try again.',
      emptyMapTitle: 'Coverage grows locally',
      emptyMapBody: 'Verified places appear as Spotters confirm them on the ground.',
      tabMap: 'Map',
      tabGuaca: 'Guaca',
      tabPlan: 'Plan',
      tabProfile: 'Profile',
      guacaTitle: 'Guaca AI',
      guacaLede: 'Plans built from real map records. Locally verified places come first; public listings are clearly labelled when nobody has visited yet.',
      guacaPlaceholder: 'Plan my day, find a beach…',
      guacaEmptyTitle: 'Ask anything about this coast',
      guacaEmptyBody: 'Explore real places with their sources clearly shown. Ask about food, landmarks or a plan for the day.',
      guacaSuggestions: [
        'Plan my day near the malecón',
        'Where can I eat arepas nearby?',
        'Which beach is best this afternoon?',
      ],
      guacaClear: 'Clear conversation',
      planTitle: 'Your plan',
      planLede: 'Your latest plan, with the source of each stop clearly shown.',
      planEmptyTitle: 'No plan yet',
      planEmptyBody: 'Ask Guaca to plan your day and the itinerary will live here.',
      planEmptyCta: 'Plan my day with Guaca',
      planFromQuestion: 'From your question',
      planViewOnMap: 'View on map',
      planClear: 'Clear plan',
      tripsTitle: 'Saved trips',
      tripsLede: 'Your saved itineraries, ready to open and share.',
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
      discoverTitle: 'Discover now',
      discoverSub: 'Live places nearby',
      discoverMore: 'See more places',
      discoverLess: 'Show fewer',
      verifiedBySpotters: 'Verified by Spotters',
      coverageTitle: 'Coverage grows locally',
      coverageBody: 'Verified places appear as Spotters confirm them on the ground.',
      nowSunset: 'sunset {time}',
      nowRain: '{pct}% rain',
      nowHoliday: 'holiday: {name}',
      nowSea: { calm: 'calm sea', moderate: 'some waves', rough: 'rough sea' },
      nowRates: '1 USD = {official} {currency} official · {parallel} parallel',
      publicListing: 'Public listing · not yet confirmed by a local',
      contactConfirmed: 'Details confirmed by a local',
      callCta: 'Call',
      websiteCta: 'Website',
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
        lodging: 'Stay',
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
      tierCorroborated: '{n} open maps agree this exists. Nobody from Guaca has stood here yet.',
      tierListed: 'Listed once in open data, unconfirmed.',
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
      discoverPlaces: 'Places',
      discoverActivities: 'To do',
      discoverStays: 'Stays',
      interestTitle: 'Your day',
      interestHint: 'Pick what you feel like. Guaca uses these as hints, not a locked itinerary.',
      interestRelax: 'Relax',
      interestAdventure: 'Adventure',
      interestCulture: 'Culture',
      interestFood: 'Food',
      actTitle: 'Things to do',
      actLede: 'Walks and stops with sourced places. Times are estimates, not ticketed tours.',
      actEmpty: 'No suggested activities for this city yet.',
      actLoading: 'Loading things to do…',
      actError: 'Could not load activities.',
      actRetry: 'Try again',
      actDuration: '{n} min',
      actWalk: 'On foot',
      actTaxi: 'By taxi',
      actMixed: 'Walk and taxi',
      actBoat: 'By boat',
      actMorning: 'Morning',
      actAfternoon: 'Afternoon',
      actSunset: 'Sunset',
      actEvening: 'Evening',
      actPlaces: 'Places on this walk',
      actAddPlan: 'Add these stops',
      actEstimate: 'Estimated time',
      stayTitle: 'Where to stay',
      stayLede: 'Filter by price and amenities. Request a room from a participating stay. No payment is taken here.',
      stayEmpty: 'No stays match those filters.',
      stayLoading: 'Loading stays…',
      stayError: 'Could not load stays.',
      stayRetry: 'Try again',
      stayNightly: '{price} / night',
      stayGuestsMax: 'Up to {n} guests',
      stayReserve: 'Request a room',
      stayNotBookable: 'This listing is not taking requests here.',
      stayPromoted: 'Promoted',
      stayPriceBand: 'Price',
      stayBandBudget: 'Simple',
      stayBandMid: 'Comfort',
      stayBandUpper: 'Wall view',
      stayAmenities: 'Amenities',
      stayAllAmenities: 'Any',
      stayCheckIn: 'Check-in',
      stayCheckOut: 'Check-out',
      stayGuests: 'Guests',
      stayNote: 'Note for the host',
      stayNotePlaceholder: 'Arrival time, extra pillows…',
      stayRequestRoom: 'Request a room',
      stayRequesting: 'Sending request…',
      stayPending: 'Awaiting confirmation',
      stayHoldUntil: 'Held until {when}',
      stayConfirmed: 'Stay confirmed',
      stayReference: 'Reference {code}',
      stayDeclined: 'The host declined this request',
      stayExpired: 'This request expired',
      stayCancelled: 'Cancelled',
      stayCompleted: 'Completed',
      stayCancel: 'Cancel request',
      stayCancelling: 'Cancelling…',
      stayCancelConfirm: 'Cancel this stay request? The hold will be released.',
      stayUnavailable: 'Those nights are not available. Try other dates.',
      stayBusyNights: 'Unavailable: {dates}',
      staySuccess: 'Request sent. The host still needs to confirm.',
      stayErrorForm: 'Could not send the request. Try again.',
      stayReview: 'Review your request',
      stayNoPayment: 'No payment is taken here. The host confirms the room.',
      stayNights: '{n} nights',
      stayOpenPlace: 'Open place',
      amenityWifi: 'Wi-Fi',
      amenityAc: 'Air conditioning',
      amenityFan: 'Fan',
      amenityBreakfast: 'Breakfast',
      amenityPool: 'Pool',
      amenityOceanView: 'Ocean view',
      amenityRooftop: 'Rooftop',
      amenityCourtyard: 'Courtyard',
      amenitySharedCourtyard: 'Shared courtyard',
      amenityHammocks: 'Hammocks',
      bookTitle: 'Your stays',
      bookEmpty: 'No stay requests yet.',
      bookLoading: 'Loading stay requests…',
      bookError: 'Could not load stay requests.',
      bookRetry: 'Try again',
      bookDirections: 'Directions',
      bookPrivate: 'Stay requests stay on this account. Shared trips never include them.',
      obsTitle: 'What we know right now',
      obsEmpty: 'No current notes for this place.',
      obsLoading: 'Loading local notes…',
      obsError: 'Could not load local notes.',
      obsRetry: 'Try again',
      obsPublicListing: 'Public listing',
      obsBusinessStatement: 'Business statement',
      obsPendingCheck: 'Pending local check',
      obsLocallyConfirmed: 'Locally confirmed',
      obsExpired: 'Expired',
      obsObserved: 'Observed {when}',
      obsRequestCheck: 'Request a check',
      obsRequesting: 'Requesting…',
      obsRequested: 'A local check was requested',
      obsNotCurrent: 'This note is no longer current.',
      obsKindSchedule: 'Hours',
      obsKindAccess: 'Access',
      obsKindService: 'Service',
      obsKindCondition: 'Condition',
      timelineWalk: 'Walk · about {n} min',
      timelineTaxi: 'Taxi · about {n} min',
      timelineBoat: 'Boat transfer · about {n} min',
      timelineSubstitute: 'Swap stop',
      timelineDuration: '{n} min',
      timelineTravel: 'Travel',
      entitlementTitle: 'Your plan',
      entitlementActive: 'Active',
      entitlementExpired: 'Expired',
      entitlementNone: 'No plan on this account.',
      entitlementNote: 'Plan status for this account. Billing is not handled in the app.',
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
      devBypassCta: 'Explorar Puerto Cabello',
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
      mapLede: 'Comprueba horarios, accesos y lugares que esperan a un local.',
      mapEmpty: 'No hay oportunidades cerca por ahora — aparecen cuando los viajeros preguntan por lugares sin verificar.',
      mapEmptyCandidates: 'Sin misiones todavía. Toca cualquier insignia pequeña: los datos abiertos conocen el lugar y tú puedes ser quien lo verifique primero.',
      legendMissions: 'Misiones',
      legendConfirm: 'Por confirmar',
      legendHeat: 'Dónde hay movimiento',
      filterAll: 'Todo',
      filterAvailable: 'Disponibles',
      filterMine: 'Mis misiones',
      filterWitness: 'Falta un testigo',
      filterDone: 'Hechas',
      filterHours: 'Horarios',
      filterAccess: 'Acceso',
      filterPhoto: 'Foto',
      filterFirst: 'Primera visita',
      spotHereCta: 'Estoy aquí',
      cityPilot: 'Puerto Cabello',
      askPlaceholder: 'Pregúntale a Guaca qué comprobar…',
      askSend: 'Preguntar a Guaca',
      askChipBreakfast: 'Horario de desayuno',
      askChipWitness: '¿Quién necesita un segundo local?',
      askChipNearby: '¿Qué hay para comprobar?',
      askError: 'Guaca no pudo responder. Inténtalo de nuevo o toca un pin.',
      taskHours: 'Horario por comprobar',
      taskAccess: 'Acceso o condiciones',
      taskEvidence: 'Hace falta evidencia',
      taskWitness: 'Falta un segundo local',
      taskDone: 'Hecha',
      previewDistance: 'Distancia',
      unverifiedInvite: 'Ficha pública, sin comprobar. Ábrela para una primera visita.',
      confirmMissionCta: 'Confirmar como segundo local',
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
      close: 'Cerrar',
      candidatesLegend: 'Candidatos',
      candidatesNudgeTitle: (n) => `${n} lugares cerca de ti siguen sin verificar`,
      candidatesNudgeBody: 'Los datos abiertos saben que existen. Nadie ha estado frente a ellos todavía. Cada uno que verifiques suma puntos.',
      candidatesNudgeCta: 'Abrir el mapa',
      candidateTitle: 'Conocido por datos públicos, sin verificar',
      candidateBody: 'Fuentes públicas lo tienen registrado. Ve, comprueba que es real, y ponlo en el mapa correctamente.',
      candidateCta: 'Verificar este lugar',
      candidatePublic: 'Listado público',
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
      rankingTitle: 'Ranking',
      monthPoints: 'Puntos',
      rankLabel: 'Puesto',
      historyTitle: 'Historial de puntos',
      pointsSuffix: 'pts',
      storeTitle: 'Tienda de puntos',
      storeNote: 'Catálogo de prueba. Canjear escribe un recibo. No se envía nada, y los puntos no son dinero.',
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
      statusExpired: 'Vencida',
      statusCancelled: 'Cancelada',
      deadlineLabel: 'Fecha límite',
      placeLabel: 'Lugar',
      evidenceLabel: 'Evidencia esperada',
      evidenceDefault: '3 fotos del lugar: la entrada, un letrero legible y la calle alrededor.',
      openMissionsTitle: 'Disponibles ahora',
      inProgressTitle: 'En curso',
      completedTitle: 'Historial completado',
      mainMission: 'Misión principal',
      altMission: 'Alternativa',
      awaitingSecond: 'Esperando un segundo local',
      awaitingSecondNote: 'Los chequeos pasaron. Otro Spotter debe confirmar en el terreno. No puedes confirmar tu propio envío.',
      expiredNote: 'Esta misión venció. Ya no se puede enviar.',
      uploadFailed: 'Falló la subida. Revisa la conexión e inténtalo de nuevo. Las fotos ya subidas se conservan.',
      duplicateEvidence: 'Una foto coincide con evidencia ya registrada. Usa una foto nueva de esta visita.',
      locationDenied: 'La ubicación es obligatoria y fue denegada. Permite la ubicación en este sitio e inténtalo en el lugar.',
      missionExpired: 'Esta misión ya no está abierta.',
      catalogEmpty: 'Aún no hay recompensas de prueba listadas.',
      catalogSandbox: 'Catálogo de prueba. Canjear escribe un recibo. No se envía nada, y los puntos no son dinero.',
      redeeming: 'Canjeando…',
      redeemDisabled: 'Aún no tienes puntos suficientes. Completa una misión para subir tu saldo.',
      redeemReceipt: 'Recibo',
      redeemDone: 'Canjeado. Se descontaron tus puntos y se escribió un recibo.',
      alreadyRedeemed: 'Ya canjeaste esta recompensa.',
      ledgerTitle: 'Libro de puntos',
      ledgerEmpty: 'Los movimientos aparecen aquí cuando se completa una misión o canjeas una recompensa.',
      pointsNotMoney: 'Los puntos no son dinero. En esta app no se convierten en un pago.',
      checksPassed: 'Los chequeos admitidos pasaron. Esperando un local independiente.',
      checksTitle: 'Chequeos de este envío',
      badgesTitle: 'Insignias',
      badgeNone: 'Las insignias aparecen después de trabajo verificado en el mapa.',
      badgeFirstPin: 'Primer pin',
      badgeWitness: 'Segundo local',
      badgeSteady: 'Récord constante',
      scenarioHint: 'Dev: entra como Spotter de la grabación con el código 000000.',
      luciaCta: 'Entrar como Lucía Castañeda',
      andresCta: 'Entrar como Andrés Pardo',
      confirmOtherAccount: 'Confirma desde una segunda cuenta de Spotter. Quien envió no puede ser el segundo local.',
      rewardCredited: 'Misión completa. Los puntos se sumaron a tu libro.',
      insufficientPoints: 'Esta recompensa cuesta más puntos de los que tienes.',
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
    merchant: {
      gateTitle: 'Entrada de anfitrión',
      gateLede: 'Escribe el correo de tu alojamiento. Te enviamos un código de un solo uso. Este espacio es solo para el lugar que hospedas, no la consola del operador.',
      emailLabel: 'Tu correo',
      sendCodeCta: 'Enviarme un código',
      codeSentTo: 'Enviamos un código de 6 dígitos a',
      codeLabel: 'Código de 6 dígitos',
      loginCta: 'Entrar',
      changeEmail: 'Usar otro correo',
      loginFailed: 'Código no reconocido. Los códigos duran 10 minutos y sirven una vez; pide uno nuevo.',
      notRegistered: 'Este correo no es una cuenta de anfitrión.',
      error: 'Falló la conexión. Intenta de nuevo.',
      devCodeHint: 'Versión de desarrollo: el código siempre es 000000.',
      devBypassCta: 'Entrar como Elena Vargas',
      tabToday: 'Hoy',
      tabReservations: 'Reservas',
      tabPlace: 'Mi lugar',
      tabVisibility: 'Visibilidad',
      todayTitle: 'Hoy en tu alojamiento',
      todayLede: 'Las solicitudes retienen una habitación hasta que confirmes o rechaces. Aquí no se cobra ningún pago.',
      todayEmpty: 'No hay solicitudes de estadía en espera. Cuando un viajero pida fechas, aparecen en Reservas.',
      todayPending: (n) => (n === 1 ? '1 solicitud de estadía en espera' : `${n} solicitudes de estadía en espera`),
      todayOpenInbox: 'Abrir reservas',
      reservationsTitle: 'Solicitudes de estadía',
      reservationsLede: 'Confirma o rechaza cada solicitud. Confirmar no es un pago.',
      reservationsEmpty: 'Aún no hay solicitudes de estadía.',
      requestStay: 'Pedir una estadía',
      awaitingConfirmation: 'En espera de confirmación',
      confirmCta: 'Confirmar estadía',
      declineCta: 'Rechazar',
      declineReason: 'Motivo (opcional)',
      declineReasonPlaceholder: 'Esas fechas ya no sirven, habitación cerrada, …',
      confirmed: 'Estadía confirmada. El viajero ve la misma reserva.',
      declined: 'Solicitud rechazada. Las noches retenidas quedaron libres.',
      guests: 'Huéspedes',
      nights: 'Noches',
      note: 'Nota',
      reference: 'Referencia',
      holdUntil: 'Retenida hasta',
      statusRequested: 'Solicitada',
      statusConfirmed: 'Confirmada',
      statusDeclined: 'Rechazada',
      statusExpired: 'Vencida',
      statusCancelled: 'Cancelada',
      statusCompleted: 'Completada',
      noPayment: 'Tarifa por noche listada. En este espacio no se cobra ningún pago.',
      placeTitle: 'Tu alojamiento',
      placeLede: 'Edita la habitación y las amenidades de este listado de escenario. Una novedad del negocio nunca marca el lugar como verificado por un local.',
      roomTypeEn: 'Tipo de habitación (inglés)',
      roomTypeEs: 'Tipo de habitación (español)',
      amenities: 'Amenidades',
      savePlace: 'Guardar listado',
      saving: 'Guardando…',
      saved: 'Listado guardado.',
      publishTitle: 'Publicar una novedad',
      publishLede: 'Esto es una declaración del negocio. Los locales aún deben confirmarla para que se lea como comprobada en el terreno.',
      publishKind: 'Qué cambió',
      publishEn: 'Novedad en inglés',
      publishEs: 'Novedad en español',
      publishCta: 'Publicar novedad del negocio',
      published: 'Novedad publicada como declaración del negocio.',
      publishedNote: 'Declaración del negocio. No está verificada por un local.',
      kindSchedule: 'Horario',
      kindAccess: 'Acceso',
      kindService: 'Servicio',
      kindCondition: 'Condición',
      visibilityTitle: 'Licencia de zona',
      visibilityLede: 'El estado de la licencia cambia cómo se muestra este alojamiento como negocio. Nunca se convierte en un sello de verificación local.',
      licenseActive: 'Activa',
      licenseExpired: 'Vencida',
      licenseRevoked: 'Revocada',
      visibilityStandard: 'Colocación estándar',
      visibilityPromoted: 'Colocación promocionada',
      promotedLabel: 'Promocionado',
      licenseNote: 'Un listado promocionado se etiqueta como promocionado. No es un pin verificado por un local ni una recomendación imparcial.',
      signOut: 'Cerrar sesión',
      loading: 'Cargando…',
      retry: 'Intentar de nuevo',
      amenityLabels: {
        fan: 'Ventilador',
        shared_courtyard: 'Patio compartido',
        hammocks: 'Hamacas',
        wifi: 'Wi-Fi',
        ac: 'Aire acondicionado',
        breakfast: 'Desayuno',
        courtyard: 'Patio',
        pool: 'Piscina',
        ocean_view: 'Vista al mar',
        rooftop: 'Terraza',
      },
    },
    tourist: {
      askPlaceholder: 'Pregúntale a Guaca sobre un lugar…',
      asking: 'Consultando con los locales…',
      refusalTitle: 'Nadie ha estado ahí todavía',
      refusalNote: 'Tu pregunta quedó registrada — puede abrir una misión pagada para un Spotter.',
      answerTitle: 'Lugares del mapa',
      placesOnMap: 'en el mapa',
      verifiedBy: 'Visitado físicamente por',
      landmarkLabel: 'Cómo encontrarlo',
      close: 'Cerrar',
      firstEyebrow: { welcome: 'Guaca', rain_replan: 'Guaca movió tu día', storm: 'Alerta de tormenta', morning_plan: 'Guaca, esta mañana', evening_checkin: '¿Cómo te fue?', stop_verified: 'Un local revisó', stop_rejected: 'Un local revisó', next_stop: 'Siguiente parada' },
      checkinGood: 'Bien',
      checkinNotThere: 'No existía',
      checkinSkipped: 'La salté',
      checkinThanks: 'Gracias, eso me enseña. "No existía" manda a un local a mirar.',
      askError: 'No pudimos conectar con Guaca — intenta de nuevo.',
      emptyMapTitle: 'La cobertura crece localmente',
      emptyMapBody: 'Los lugares verificados aparecen cuando los Spotters los confirman en el terreno.',
      tabMap: 'Mapa',
      tabGuaca: 'Guaca',
      tabPlan: 'Plan',
      tabProfile: 'Perfil',
      guacaTitle: 'Guaca AI',
      guacaLede: 'Planes hechos con lugares del mapa. Primero los verificados por locales; las fichas públicas se indican cuando nadie los ha visitado aún.',
      guacaPlaceholder: 'Planifica mi día, busca una playa…',
      guacaEmptyTitle: 'Pregunta lo que sea sobre esta costa',
      guacaEmptyBody: 'Explora lugares reales con sus fuentes a la vista. Pregunta por comida, sitios históricos o un plan para el día.',
      guacaSuggestions: [
        'Planifica mi día cerca del malecón',
        '¿Dónde puedo comer arepas cerca?',
        '¿Qué playa es mejor esta tarde?',
      ],
      guacaClear: 'Borrar conversación',
      planTitle: 'Tu plan',
      planLede: 'Tu último plan, con la fuente de cada parada a la vista.',
      planEmptyTitle: 'Aún no hay plan',
      planEmptyBody: 'Pídele a Guaca que planifique tu día y el itinerario vivirá aquí.',
      planEmptyCta: 'Planificar mi día con Guaca',
      planFromQuestion: 'De tu pregunta',
      planViewOnMap: 'Ver en el mapa',
      planClear: 'Borrar plan',
      tripsTitle: 'Viajes guardados',
      tripsLede: 'Tus itinerarios guardados, listos para abrir y compartir.',
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
      discoverTitle: 'Descubre ahora',
      discoverSub: 'Lugares vivos cerca',
      discoverMore: 'Ver más lugares',
      discoverLess: 'Ver menos',
      verifiedBySpotters: 'Verificado por Spotters',
      coverageTitle: 'La cobertura crece localmente',
      coverageBody: 'Los lugares verificados aparecen cuando los Spotters los confirman en el terreno.',
      nowSunset: 'atardecer {time}',
      nowRain: '{pct}% lluvia',
      nowHoliday: 'feriado: {name}',
      nowSea: { calm: 'mar en calma', moderate: 'algo de oleaje', rough: 'mar picado' },
      nowRates: '1 USD = {official} {currency} oficial · {parallel} paralelo',
      publicListing: 'Listado público · aún no confirmado por un local',
      contactConfirmed: 'Datos confirmados por un local',
      callCta: 'Llamar',
      websiteCta: 'Sitio web',
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
        lodging: 'Alojamiento',
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
      tierCorroborated: '{n} mapas abiertos coinciden en que existe. Nadie de Guaca ha estado aquí todavía.',
      tierListed: 'Listado una vez en datos abiertos, sin confirmar.',
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
      discoverPlaces: 'Lugares',
      discoverActivities: 'Qué hacer',
      discoverStays: 'Alojamiento',
      interestTitle: 'Tu día',
      interestHint: 'Elige lo que te apetece. Guaca lo usa como pista, no como itinerario cerrado.',
      interestRelax: 'Relajo',
      interestAdventure: 'Aventura',
      interestCulture: 'Cultura',
      interestFood: 'Comida',
      actTitle: 'Qué hacer',
      actLede: 'Paseos y paradas con lugares de fuente. Los horarios son estimados, no tours con boleto.',
      actEmpty: 'Aún no hay actividades sugeridas para esta ciudad.',
      actLoading: 'Cargando qué hacer…',
      actError: 'No se pudieron cargar las actividades.',
      actRetry: 'Intentar de nuevo',
      actDuration: '{n} min',
      actWalk: 'A pie',
      actTaxi: 'En taxi',
      actMixed: 'A pie y en taxi',
      actBoat: 'En lancha',
      actMorning: 'Mañana',
      actAfternoon: 'Tarde',
      actSunset: 'Atardecer',
      actEvening: 'Noche',
      actPlaces: 'Lugares de este recorrido',
      actAddPlan: 'Agregar estas paradas',
      actEstimate: 'Tiempo estimado',
      stayTitle: 'Dónde quedarse',
      stayLede: 'Filtra por precio y servicios. Pide una habitación en un alojamiento participante. Aquí no se cobra.',
      stayEmpty: 'Ningún alojamiento coincide con esos filtros.',
      stayLoading: 'Cargando alojamientos…',
      stayError: 'No se pudieron cargar los alojamientos.',
      stayRetry: 'Intentar de nuevo',
      stayNightly: '{price} / noche',
      stayGuestsMax: 'Hasta {n} huéspedes',
      stayReserve: 'Pedir una habitación',
      stayNotBookable: 'Este listado no recibe solicitudes aquí.',
      stayPromoted: 'Promocionado',
      stayPriceBand: 'Precio',
      stayBandBudget: 'Sencillo',
      stayBandMid: 'Cómodo',
      stayBandUpper: 'Vista a la muralla',
      stayAmenities: 'Servicios',
      stayAllAmenities: 'Cualquiera',
      stayCheckIn: 'Entrada',
      stayCheckOut: 'Salida',
      stayGuests: 'Huéspedes',
      stayNote: 'Nota para el anfitrión',
      stayNotePlaceholder: 'Hora de llegada, almohadas extra…',
      stayRequestRoom: 'Pedir una habitación',
      stayRequesting: 'Enviando solicitud…',
      stayPending: 'Esperando confirmación',
      stayHoldUntil: 'Reservado hasta {when}',
      stayConfirmed: 'Estadía confirmada',
      stayReference: 'Referencia {code}',
      stayDeclined: 'El anfitrión rechazó esta solicitud',
      stayExpired: 'Esta solicitud venció',
      stayCancelled: 'Cancelada',
      stayCompleted: 'Completada',
      stayCancel: 'Cancelar solicitud',
      stayCancelling: 'Cancelando…',
      stayCancelConfirm: '¿Cancelar esta solicitud de estadía? Se libera el cupo.',
      stayUnavailable: 'Esas noches no están disponibles. Prueba otras fechas.',
      stayBusyNights: 'No disponible: {dates}',
      staySuccess: 'Solicitud enviada. El anfitrión aún debe confirmar.',
      stayErrorForm: 'No se pudo enviar la solicitud. Inténtalo de nuevo.',
      stayReview: 'Revisa tu solicitud',
      stayNoPayment: 'Aquí no se cobra. El anfitrión confirma la habitación.',
      stayNights: '{n} noches',
      stayOpenPlace: 'Ver lugar',
      amenityWifi: 'Wi-Fi',
      amenityAc: 'Aire acondicionado',
      amenityFan: 'Ventilador',
      amenityBreakfast: 'Desayuno',
      amenityPool: 'Piscina',
      amenityOceanView: 'Vista al mar',
      amenityRooftop: 'Terraza',
      amenityCourtyard: 'Patio',
      amenitySharedCourtyard: 'Patio compartido',
      amenityHammocks: 'Hamacas',
      bookTitle: 'Tus estadías',
      bookEmpty: 'Aún no hay solicitudes de estadía.',
      bookLoading: 'Cargando solicitudes…',
      bookError: 'No se pudieron cargar las solicitudes.',
      bookRetry: 'Intentar de nuevo',
      bookDirections: 'Cómo llegar',
      bookPrivate: 'Las solicitudes de estadía quedan en esta cuenta. Un viaje compartido nunca las incluye.',
      obsTitle: 'Lo que sabemos ahora',
      obsEmpty: 'No hay notas actuales de este lugar.',
      obsLoading: 'Cargando notas locales…',
      obsError: 'No se pudieron cargar las notas locales.',
      obsRetry: 'Intentar de nuevo',
      obsPublicListing: 'Listado público',
      obsBusinessStatement: 'Declaración del negocio',
      obsPendingCheck: 'Comprobación local pendiente',
      obsLocallyConfirmed: 'Confirmado por un local',
      obsExpired: 'Vencido',
      obsObserved: 'Observado {when}',
      obsRequestCheck: 'Pedir una comprobación',
      obsRequesting: 'Solicitando…',
      obsRequested: 'Se pidió una comprobación local',
      obsNotCurrent: 'Esta nota ya no es actual.',
      obsKindSchedule: 'Horario',
      obsKindAccess: 'Acceso',
      obsKindService: 'Servicio',
      obsKindCondition: 'Condición',
      timelineWalk: 'A pie · unos {n} min',
      timelineTaxi: 'Taxi · unos {n} min',
      timelineBoat: 'Traslado en lancha · unos {n} min',
      timelineSubstitute: 'Cambiar parada',
      timelineDuration: '{n} min',
      timelineTravel: 'Traslado',
      entitlementTitle: 'Tu plan',
      entitlementActive: 'Activo',
      entitlementExpired: 'Vencido',
      entitlementNone: 'No hay plan en esta cuenta.',
      entitlementNote: 'Estado del plan de esta cuenta. La facturación no se hace en la app.',
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
