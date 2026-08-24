/**
 * HTML email bodies. Email clients are the one place the modern CSS
 * toolbox does not reach: no web fonts, no flex, inconsistent dark mode,
 * and Outlook still lays out with tables. So this is tables, inline
 * styles, a single 600px column, and every colour painted explicitly from
 * the brand palette in @guaca/ui/theme.css rather than inherited.
 *
 * Every template also has a plain-text twin. Resend sends both, and the
 * text part is what screen readers, watches and strict clients show.
 */

const PALETTE = {
  paper: '#FBF4EB',
  ink: '#0A1F24',
  inkLight: '#2D4A50',
  teal: '#0D8B8B',
  tealDark: '#0A6B6B',
  tealLight: '#A8DDD4',
  ocean: '#0C4A5C',
  coral: '#E8735A',
  mango: '#D4A853',
  mist: '#EEF7F5',
  white: '#FFFFFF',
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface WaitlistEmailInput {
  /** traveler, spotter or owner: shapes one sentence in the body. */
  role: string;
  language: string;
  /** Public site, used for links in the body and footer. */
  siteUrl: string;
  /** Origin that serves /api/assets/email/*; defaults to the site. */
  assetUrl?: string;
}

export interface EmailBody {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function waitlistConfirmation(input: WaitlistEmailInput): EmailBody {
  const es = input.language === 'es';
  const site = input.siteUrl.replace(/\/$/, '');
  const assets = (input.assetUrl ?? input.siteUrl).replace(/\/$/, '') + '/api/assets/email';

  type Role = 'traveler' | 'spotter' | 'owner';
  const role: Role = input.role === 'spotter' || input.role === 'owner' ? input.role : 'traveler';

  /*
   * Three people sign up for three different reasons, so three emails.
   * What stays shared is the promise (Rob's message paragraph), the launch
   * card and the footer. What changes is everything that answers "what
   * happens to ME now": subject, headline, the second paragraph, the CTA
   * note, and the four value props.
   */
  const shared = es
    ? {
        lede:
          'Gracias por unirte a Guaca. Estamos construyendo un mapa vivo del Caribe hecho por personas que realmente están allí: locales que verifican qué está abierto, qué vale la pena visitar y qué ha cambiado, antes de que te llegue a ti.',
        whatTitle: '¿Qué es Guaca?',
        whatLede:
          'Un mapa hecho por la comunidad que ayuda a viajeros y locales a descubrir qué está abierto, qué está pasando y qué vale la pena, ahora mismo.',
        launchTitle: 'Sé parte del lanzamiento',
        launchBody:
          'Estamos construyendo Guaca para la comunidad caribeña. Tu apoyo temprano nos ayuda a crecer algo útil, honesto y local.',
        thanks: '¡Gracias! 🌴',
        signoff: 'El equipo de Guaca',
        footer1: 'Recibes este correo porque te uniste a la lista de espera de Guaca.',
        footer2: 'Si no fuiste tú, puedes ignorarlo sin problema.',
        alt: 'La app de Guaca: el mapa de Puerto Cabello con lugares verificados y el perfil de un spotter',
      }
    : {
        lede:
          "Thanks for joining Guaca. We're building a live Caribbean map powered by people who are actually there: locals verify what's open, what's worth visiting, and what's changed before it reaches you.",
        whatTitle: 'What is Guaca?',
        whatLede:
          "A community-powered map that helps travellers and locals discover what's open, what's happening, and what's worth it, right now.",
        launchTitle: 'Be part of the launch',
        launchBody:
          "We're building Guaca for the Caribbean community. Your early support helps us grow something useful, honest and local.",
        thanks: 'Gracias! 🌴',
        signoff: 'The Guaca Team',
        footer1: "You're receiving this email because you joined the Guaca waitlist.",
        footer2: "If you didn't sign up for this, you can safely ignore this email.",
        alt: 'The Guaca app: the Puerto Cabello map with verified places, and a spotter profile',
      };

  type Props = [string, string][];
  interface RoleCopy {
    subject: string; pill: string; title: string; lede2: string; role: string;
    cta: string; ctaNote: string; props: Props;
  }

  const byRole: Record<Role, RoleCopy> = es
    ? {
        traveler: {
          subject: 'Estás en la lista de Guaca 🌴',
          pill: 'ESTÁS EN LA LISTA DE ESPERA',
          title: '¡Gracias por unirte a la lista de espera de Guaca!',
          lede2:
            'A medida que abrimos cobertura comunidad por comunidad, te avisaremos cuando Guaca esté lista en tu zona. Hasta entonces, ya estás oficialmente en la lista, y un poco más cerca de explorar el Caribe con información en la que puedes confiar.',
          role: 'Te uniste como viajero.',
          cta: '🎉 Estás en la lista',
          ctaNote: 'Te escribiremos en cuanto abramos en tu zona.',
          props: [
            ['Actualizaciones en vivo', 'Información real de personas que están en el lugar.'],
            ['Pregúntale a Guaca', 'Planes con lugares que un local ya comprobó, nunca inventados.'],
            ['Verificado por dos locales', 'Un lugar solo aparece cuando dos personas lo confirman en el sitio.'],
            ['Guarda y comparte', 'Favoritos, reseñas de lo que visitaste y planes para compartir.'],
          ],
        },
        spotter: {
          subject: 'Bienvenido a los Spotters de Guaca 📍',
          pill: 'SPOTTER EN LISTA DE ESPERA',
          title: '¡Gracias por querer mantener el mapa fiel!',
          lede2:
            'Como spotter, tú eres la fuente. Cuando abramos tu comunidad te enviaremos un código de acceso por WhatsApp, y desde ese momento recibirás misiones: ir a un lugar, tomar unas fotos y confirmar qué encontraste. Un lugar solo aparece en el mapa cuando dos spotters lo confirman, así que tu trabajo es literalmente lo que hace que Guaca sea confiable.',
          role: 'Te uniste como spotter local, una de las personas que mantienen el mapa fiel.',
          cta: '📍 Estás en la lista de spotters',
          ctaNote: 'Te escribiremos con tu código cuando abramos tu comunidad.',
          props: [
            ['Misiones', 'Te proponemos lugares cerca de ti que alguien preguntó y nadie ha comprobado.'],
            ['Dos testigos', 'Tu verificación cuenta cuando otro spotter la confirma. Así nadie inventa nada.'],
            ['Puntos y niveles', 'Cada lugar verificado suma puntos, sube tu nivel y se canjea en la tienda.'],
            ['Tu nombre en el pin', 'Cada lugar que verifiques lleva tu nombre. La reputación es tuya.'],
          ],
        },
        owner: {
          subject: 'Tu negocio y Guaca 🏝️',
          pill: 'NEGOCIO EN LISTA DE ESPERA',
          title: '¡Gracias por querer poner tu negocio en el mapa!',
          lede2:
            'Los negocios aún no pueden unirse directamente: estamos abriendo comunidad por comunidad, y te escribiremos en cuanto puedas reclamar tu lugar en tu zona. Mientras tanto, si un spotter local ya verificó tu negocio, es posible que ya esté en el mapa, y los viajeros ya pueden estar preguntando por él.',
          role: 'Te uniste como negocio.',
          cta: '🏝️ Estás en la lista',
          ctaNote: 'Te avisaremos cuando los negocios puedan unirse en tu zona.',
          props: [
            ['Aparece en el mapa', 'Los viajeros te encuentran cuando preguntan qué hay cerca.'],
            ['Verificado por un local', 'Un spotter confirma tu negocio en persona. Eso es lo que genera confianza.'],
            ['Estado en vivo', 'Abierto, cerrado, horarios: la información que cambia, actualizada.'],
            ['Novedades a los viajeros', 'Publica cambios y llegan a quien está cerca.'],
          ],
        },
      }
    : {
        traveler: {
          subject: "You're on the Guaca waitlist 🌴",
          pill: "YOU'RE ON THE WAITLIST",
          title: 'Thanks for joining the Guaca waitlist!',
          lede2:
            "As we open coverage community by community, we'll let you know when Guaca is ready in your area. Until then, you're officially on the list, and a little closer to exploring the Caribbean with information you can actually trust.",
          role: 'You joined as a traveller.',
          cta: "🎉 You're on the list",
          ctaNote: "We'll email you as soon as we open in your area.",
          props: [
            ['Live updates', 'Real information from people on the ground.'],
            ['Ask Guaca', 'Plans built only from places a local has checked, never invented.'],
            ['Verified by two locals', 'A place only appears once two people confirm it in person.'],
            ['Save and share', 'Favourites, reviews of places you visited, and plans you can share.'],
          ],
        },
        spotter: {
          subject: 'Welcome to the Guaca Spotters 📍',
          pill: 'SPOTTER ON THE WAITLIST',
          title: 'Thanks for wanting to keep the map true!',
          lede2:
            "As a spotter, you are the source. When we open your community we'll send you a login code by WhatsApp, and from then on you'll receive missions: go to a place, take a few photos, and confirm what you found. A place only appears on the map once two spotters confirm it, so your work is literally what makes Guaca trustworthy.",
          role: 'You joined as a local spotter, one of the people who keep the map true.',
          cta: "📍 You're on the spotter list",
          ctaNote: "We'll write with your code when we open your community.",
          props: [
            ['Missions', "We suggest places near you that someone asked about and nobody has checked."],
            ['Two witnesses', 'Your verification counts once another spotter confirms it. Nobody invents anything.'],
            ['Points and levels', 'Every verified place earns points, raises your level, and redeems in the store.'],
            ['Your name on the pin', 'Every place you verify carries your name. The reputation is yours.'],
          ],
        },
        owner: {
          subject: 'Your business and Guaca 🏝️',
          pill: 'BUSINESS ON THE WAITLIST',
          title: 'Thanks for wanting to put your business on the map!',
          lede2:
            "Businesses can't join directly yet: we're opening community by community, and we'll write as soon as you can claim your place in your area. In the meantime, if a local spotter has already verified your business, it may already be on the map, and travellers may already be asking about it.",
          role: 'You joined as a business.',
          cta: "🏝️ You're on the list",
          ctaNote: "We'll tell you when businesses can join in your area.",
          props: [
            ['Appear on the map', 'Travellers find you when they ask what is nearby.'],
            ['Verified by a local', 'A spotter confirms your business in person. That is what builds trust.'],
            ['Live status', 'Open, closed, hours: the information that changes, kept current.'],
            ['Updates reach travellers', 'Post a change and it reaches whoever is nearby.'],
          ],
        },
      };

  const t = { ...shared, ...byRole[role] };

  const text = [
    t.title,
    '',
    t.lede,
    '',
    t.lede2,
    '',
    t.role,
    '',
    `${t.whatTitle} ${t.whatLede}`,
    '',
    ...t.props.map(([h, b]) => `• ${h}: ${b}`),
    '',
    t.launchBody,
    '',
    `${t.thanks} ${t.signoff}`,
    '',
    site,
    '',
    t.footer1,
    t.footer2,
  ].join('\n');

  const p = PALETTE;
  const propIcons = [
    // simple inline-safe glyphs; images would be blocked in many clients
    { glyph: '📍', color: p.teal },
    { glyph: '🤝', color: p.coral },
    { glyph: '🎁', color: p.mango },
    { glyph: '✅', color: p.ocean },
  ];

  const propsHtml = t.props
    .map(
      ([h, b], i) => `
        <td class="col" width="25%" valign="top" style="padding:0 8px;text-align:center;font-family:${FONT};">
          <div style="font-size:28px;line-height:1;margin-bottom:10px;">${propIcons[i]!.glyph}</div>
          <div style="font-size:14px;font-weight:800;color:${p.ink};margin-bottom:4px;">${escapeHtml(h)}</div>
          <div style="font-size:12px;line-height:1.5;color:${p.inkLight};">${escapeHtml(b)}</div>
        </td>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="${es ? 'es' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(t.subject)}</title>
<style>
  @media (max-width:620px){
    .col{display:inline-block!important;width:46%!important;padding:12px 2%!important;box-sizing:border-box;vertical-align:top;}
    .pad{padding-left:20px!important;padding-right:20px!important;}
    .h1{font-size:30px!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${p.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(t.lede)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.paper};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${p.white};border-radius:24px;overflow:hidden;">

  <!-- logo -->
  <tr><td class="pad" style="padding:36px 40px 0;">
    <img src="${assets}/wordmark.png" width="150" alt="Guaca" style="display:block;height:auto;border:0;">
  </td></tr>

  <!-- pill + title -->
  <tr><td class="pad" style="padding:32px 40px 0;font-family:${FONT};">
    <span style="display:inline-block;background:${p.mist};color:${p.tealDark};font-size:11px;font-weight:800;letter-spacing:.08em;padding:8px 14px;border-radius:999px;">&#9679;&nbsp; ${escapeHtml(t.pill)}</span>
    <h1 class="h1" style="margin:22px 0 0;font-size:36px;line-height:1.05;letter-spacing:-.03em;font-weight:900;color:${p.ink};">${escapeHtml(t.title)}</h1>
    <div style="width:120px;height:4px;background:${p.coral};border-radius:999px;margin:16px 0 0;transform:rotate(-2deg);"></div>
  </td></tr>

  <!-- the message -->
  <tr><td class="pad" style="padding:24px 40px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${p.inkLight};">
    <p style="margin:0 0 16px;">${escapeHtml(t.lede)}</p>
    <p style="margin:0 0 16px;">${escapeHtml(t.lede2)}</p>
    <p style="margin:0;font-weight:700;color:${p.ink};">${escapeHtml(t.role)}</p>
  </td></tr>

  <!-- cta -->
  <tr><td class="pad" style="padding:28px 40px 0;font-family:${FONT};">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${p.teal};border-radius:14px;">
        <a href="${site}" style="display:inline-block;padding:16px 28px;color:${p.white};font-size:15px;font-weight:800;text-decoration:none;">${escapeHtml(t.cta)}</a>
      </td>
    </tr></table>
    <p style="margin:12px 0 0;font-size:13px;color:${p.inkLight};">${escapeHtml(t.ctaNote)}</p>
  </td></tr>

  <!-- hero image -->
  <tr><td align="center" style="padding:32px 0 0;text-align:center;">
    <img src="${assets}/hero-app.jpg" width="600" alt="${escapeHtml(t.alt)}" style="display:block;margin:0 auto;width:100%;max-width:600px;height:auto;border:0;font-family:${FONT};font-size:13px;color:${p.inkLight};text-align:center;">
  </td></tr>

  <!-- what is guaca -->
  <tr><td class="pad" style="padding:36px 40px 0;font-family:${FONT};text-align:center;">
    <h2 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-.02em;color:${p.teal};">${escapeHtml(t.whatTitle)}</h2>
    <p style="margin:10px auto 0;max-width:460px;font-size:15px;line-height:1.55;color:${p.inkLight};">${escapeHtml(t.whatLede)}</p>
  </td></tr>
  <tr><td class="pad" style="padding:28px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${propsHtml}</tr></table>
  </td></tr>

  <!-- launch card -->
  <tr><td class="pad" style="padding:36px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.mist};border-radius:20px;">
      <tr><td style="padding:28px 28px;font-family:${FONT};">
        <h3 style="margin:0;font-size:20px;font-weight:900;color:${p.teal};">${escapeHtml(t.launchTitle)}</h3>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:${p.inkLight};">${escapeHtml(t.launchBody)}</p>
        <p style="margin:18px 0 0;font-size:16px;font-weight:800;color:${p.ink};">${escapeHtml(t.thanks)}</p>
        <p style="margin:4px 0 0;font-size:14px;color:${p.inkLight};">${escapeHtml(t.signoff)}</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- footer -->
  <tr><td class="pad" style="padding:32px 40px 36px;font-family:${FONT};text-align:center;font-size:12px;line-height:1.6;color:${p.inkLight};">
    <a href="${site}" style="color:${p.teal};font-weight:700;text-decoration:none;">guaca.live</a>
    <p style="margin:14px 0 0;">${escapeHtml(t.footer1)}<br>${escapeHtml(t.footer2)}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: t.subject, text, html };
}
