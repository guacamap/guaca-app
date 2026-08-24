import {
  ArrowRight,
  Award,
  BadgeCheck,
  Camera,
  ClipboardCheck,
  Clock3,
  Compass,
  Gift,
  MailPlus,
  Map as MapIcon,
  MapPinned,
  MessageCircle,
  Medal,
  Smartphone,
  Store,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@guaca/ui'
import { GuacaLogo } from '@guaca/ui'
import { GuacaMap } from '@guaca/ui'
import { PalmFrondLeft } from '@guaca/ui'
import { formatUpdateTime, useInfoStore } from '@guaca/ui'
import { useLanguage, type Lang } from '@guaca/ui'
import { JoinWaitlist } from '@/components/JoinWaitlist'
import { landingCopy } from '@/lib/landingCopy'


const roleMeta = [
  { id: 'tourist' as const, icon: Compass, tone: 'bg-guaca-teal/8 text-guaca-teal' },
  { id: 'spotter' as const, icon: Camera, tone: 'bg-guaca-coral/8 text-guaca-coral-dark' },
  { id: 'operator' as const, icon: Store, tone: 'bg-guaca-ocean/8 text-guaca-ocean' },
]

export function MarketingLanding() {
  const { updates } = useInfoStore()
  const { lang, setLang } = useLanguage()
  const t = landingCopy[lang]
  const latestUpdate = updates[0]
  const pendingUpdates = updates.filter((update) => update.status === 'published')

  const goToWaitlist = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.requestAnimationFrame(() => {
      document.getElementById('waitlist')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
    })
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-guaca-ink">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 w-[min(1180px,calc(100%_-_32px))] items-center gap-6 px-4 sm:px-0">
          <a href="#top" className="flex min-h-11 items-center rounded-xl" aria-label={t.ariaHome}>
            <GuacaLogo className="h-[54px] sm:h-[58px]" />
          </a>
          <nav className="ml-auto hidden items-center gap-7 text-[13px] font-bold text-guaca-ink/70 lg:flex" aria-label={t.ariaMainNav}>
            <a className="landing-link" href="#how">{t.nav.how}</a>
            <a className="landing-link" href="#live">{t.nav.live}</a>
            <a className="landing-link" href="#spotters">{t.nav.spotters}</a>
            <a className="landing-link" href="#waitlist">{t.nav.waitlist}</a>
          </nav>
          <a href="#waitlist" className="ml-auto hidden min-h-11 items-center justify-center rounded-full bg-guaca-teal px-5 text-xs font-extrabold text-white shadow-lg shadow-guaca-teal/20 transition-colors hover:bg-guaca-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-ocean-deep focus-visible:ring-offset-2 sm:inline-flex lg:ml-0">
            {t.joinWaitlist} <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </a>
          <a href="#waitlist" aria-label={t.ariaJoinWaitlist} className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-white/80 text-guaca-ocean shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-teal focus-visible:ring-offset-2 sm:hidden">
            <MailPlus aria-hidden="true" className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-0.5 rounded-full bg-white/80 p-1 shadow-sm backdrop-blur" role="group" aria-label={t.ariaLanguage}>
            {(['en', 'es'] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`h-8 rounded-full px-2.5 text-[10px] font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-teal ${lang === code ? 'bg-guaca-teal text-white' : 'text-guaca-ink/55 hover:text-guaca-ink'}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero relative isolate overflow-hidden pt-28">
          <div className="landing-hero-glow absolute inset-0 -z-20" />
          <div className="landing-hero-contours absolute inset-0 -z-10" aria-hidden="true" />
          <PalmFrondLeft className="landing-palm-shadow pointer-events-none absolute -left-10 -top-12 -z-10 h-[380px] w-[300px]" />
          <div className="mx-auto grid min-h-[710px] w-[min(1180px,calc(100%_-_32px))] items-center gap-8 px-4 pb-16 sm:px-0 lg:grid-cols-[.92fr_1.08fr]">
            <div className="max-w-xl pt-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-guaca-teal/12 bg-white/76 px-3 py-2 text-[10px] font-black tracking-[.08em] text-guaca-ocean shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                {t.hero.badge}
              </p>
              <h1 className="mt-6 text-[clamp(3rem,7vw,5.7rem)] font-black leading-[.91] tracking-[-.075em] text-guaca-ocean-deep">
                {t.hero.titleTop}<br />
                <span className="guaca-script font-black text-guaca-teal">{t.hero.titleScript}</span>
              </h1>
              <div className="landing-scribble mt-3 h-3 w-36" aria-hidden="true" />
              <p className="mt-7 max-w-lg text-base font-medium leading-7 text-guaca-ink/70 sm:text-lg">
                {t.hero.lede}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button type="button" onClick={() => goToWaitlist()} className="h-13 rounded-xl bg-guaca-teal px-6 text-sm font-extrabold text-white shadow-xl shadow-guaca-teal/20 hover:bg-guaca-teal-dark">
                  <MailPlus aria-hidden="true" className="mr-2 h-4 w-4" /> {t.joinWaitlist}
                </Button>
                <span className="inline-flex h-13 items-center justify-center rounded-xl border border-dashed border-guaca-teal/35 bg-white/60 px-6 text-sm font-extrabold text-guaca-teal/75 backdrop-blur">
                  <Smartphone aria-hidden="true" className="mr-2 h-4 w-4" /> {t.hero.appComingSoon}
                </span>
              </div>
              <div className="mt-7 flex items-center gap-4 text-xs font-bold text-guaca-ink/52">
                <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-guaca-teal" /> {t.hero.localVerification}</span>
                <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-guaca-coral" /> {t.hero.liveReports}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[760px] max-lg:mt-4">
              {/* Concept render of the product: both phones, the live cards
                  and the backdrop are one transparent PNG, so it drops onto
                  the hero gradient without a seam. */}
              <img
                src="/assets/landing-hero-app.webp"
                width="1400"
                height="933"
                alt={t.phoneTourist.imgAlt}
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section id="how" className="bg-guaca-paper py-24">
          <div className="mx-auto w-[min(1180px,calc(100%_-_32px))] px-4 sm:px-0">
            <div className="text-center"><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-teal">{t.how.eyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">{t.how.title}</h2><p className="mx-auto mt-4 max-w-xl text-guaca-ink/58">{t.how.lede}</p></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {roleMeta.map(({ id, icon: Icon, tone }) => {
                const role = t.roles[id]
                return (
                  <button key={id} type="button" onClick={() => goToWaitlist()} className="group min-h-[290px] rounded-[32px] border border-guaca-sand bg-white p-7 text-left shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-teal focus-visible:ring-offset-2">
                    <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${tone}`}><Icon aria-hidden="true" className="h-10 w-10" /></div>
                    <div className="mt-8"><h3 className="text-xl font-black">{role.title}</h3></div>
                    <p className="mt-3 text-sm font-medium leading-6 text-guaca-ink/60">{role.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-black text-guaca-teal">{t.how.joinAsPrefix}{role.title}<ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1" /></span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section id="live" className="overflow-hidden bg-white py-24">
          <div className="mx-auto grid w-[min(1180px,calc(100%_-_32px))] items-center gap-12 px-4 sm:px-0 lg:grid-cols-2">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-teal">{t.live.eyebrow}</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">{t.live.titleTop}<br /><span className="guaca-script text-guaca-teal">{t.live.titleScript}</span></h2><p className="mt-5 max-w-lg text-base leading-7 text-guaca-ink/60">{t.live.lede}</p><div className="mt-8 grid grid-cols-2 gap-3">{[BadgeCheck, Clock3, MapPinned, Users].map((FeatureIcon, index) => <div key={t.live.features[index]} className="flex min-h-20 items-center gap-3 rounded-2xl bg-guaca-teal/5 p-4"><FeatureIcon className="h-5 w-5 text-guaca-teal" /><span className="text-sm font-black">{t.live.features[index]}</span></div>)}</div></div>
            <div className="relative min-h-[470px] overflow-hidden rounded-[40px] shadow-2xl ring-1 ring-guaca-ocean-deep/10">
              {/* Pointer events stay off so the page scroll never fights the map. */}
              <div className="pointer-events-none absolute inset-0">
                <GuacaMap pins={[]} mapStyle="streets" center={[-73.5, 15.6]} zoom={3.82} fallbackImage="/assets/landing-caribbean-wide.jpg" />
              </div>
              {/* Warm the street style toward Guaca's turquoise sea. */}
              <div className="pointer-events-none absolute inset-0 bg-guaca-teal/16 mix-blend-multiply" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-guaca-ocean-deep/38 via-transparent to-guaca-teal/12" />
              <div className="absolute left-5 top-5 rounded-full bg-white/90 px-3.5 py-2 text-[10px] font-black uppercase tracking-[.1em] text-guaca-ocean shadow-lg backdrop-blur">
                <MapPinned className="mr-1.5 inline h-3.5 w-3.5 text-guaca-teal" /> {t.live.mapBadge}
              </div>
              <div className="absolute inset-x-5 bottom-5 space-y-3">
                {updates.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/92 p-3.5 shadow-xl backdrop-blur">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-guaca-coral/12 text-guaca-coral"><MapPinned className="h-5 w-5" /></span>
                    <div className="min-w-0"><p className="text-xs font-black text-guaca-ink">{t.live.emptyTitle}</p><p className="mt-0.5 text-[10px] font-semibold text-guaca-ink/50">{t.live.emptyBody}</p></div>
                  </div>
                ) : updates.slice(0, 3).map((update) => (
                  <div key={update.id} className="flex items-center gap-3 rounded-2xl bg-white/92 p-4 shadow-xl backdrop-blur">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-guaca-teal text-xs font-black text-white">{update.businessName.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0"><p className="truncate text-[10px] font-black text-guaca-teal-dark">{update.businessName}{update.community ? ` · ${update.community}` : ''}</p><p className="line-clamp-2 text-xs font-black leading-4">{update.title}</p><p className="mt-1 text-[9px] font-bold text-guaca-ink/44">{formatUpdateTime(update.createdAt)}</p></div>
                    {update.status === 'verified' ? <BadgeCheck className="ml-auto h-5 w-5 shrink-0 text-emerald-600" /> : <Clock3 className="ml-auto h-5 w-5 shrink-0 text-guaca-ink/35" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="spotters" className="bg-guaca-ocean-deep py-24 text-white">
          <div className="mx-auto grid w-[min(1180px,calc(100%_-_32px))] items-center gap-12 px-4 sm:px-0 lg:grid-cols-[.9fr_1.1fr]">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-lagoon">{t.spotters.eyebrow}</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">{t.spotters.title}</h2><p className="mt-5 max-w-lg leading-7 text-white/68">{t.spotters.lede}</p><Button type="button" onClick={() => goToWaitlist()} className="mt-8 h-12 rounded-xl bg-guaca-coral px-6 font-black text-white hover:bg-guaca-coral-dark"><Trophy className="mr-2 h-4 w-4" /> {t.spotters.cta}</Button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-h-64 flex-col rounded-[30px] bg-white/8 p-6">
                <div className="grid flex-1 place-items-center rounded-3xl bg-guaca-coral/14">
                  <Camera aria-hidden="true" className="h-20 w-20 text-guaca-coral-light" strokeWidth={1.5} />
                </div>
                <p className="mt-5 text-center text-lg font-black">{t.spotters.card1}</p>
              </div>
              <div className="flex min-h-64 flex-col rounded-[30px] bg-white/8 p-6">
                <div className="grid grid-cols-3 gap-3">
                  {[Award, Gift, Medal].map((RewardIcon, index) => (
                    <div key={index} className="grid aspect-square place-items-center rounded-2xl bg-white/10 text-guaca-mango-light">
                      <RewardIcon aria-hidden="true" className="h-8 w-8" strokeWidth={1.6} />
                    </div>
                  ))}
                </div>
                <p className="mt-auto pt-7 text-lg font-black">{t.spotters.card2}</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-white/65"><Gift aria-hidden="true" className="h-4 w-4" /> {t.spotters.card2Sub}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="waitlist" className="scroll-mt-4 bg-guaca-teal py-24 text-white">
          <div className="mx-auto grid w-[min(1080px,calc(100%_-_32px))] items-center gap-12 px-4 sm:px-0 lg:grid-cols-[.85fr_1.15fr]">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-mango-light">{t.waitlist.eyebrow}</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">{t.waitlist.title}</h2><p className="mt-5 max-w-lg leading-7 text-white/76">{t.waitlist.lede}</p><div className="mt-8 space-y-3 text-sm font-bold text-white/80">{t.waitlist.steps.map((label, index) => <div key={label} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-[10px] text-guaca-mango-light">{String(index + 1).padStart(2, '0')}</span><span>{label}</span></div>)}</div></div>
            <JoinWaitlist t={t.waitlist} lang={lang} />
          </div>
        </section>

        <section id="businesses" className="bg-guaca-ocean-deep py-20 text-white"><div className="mx-auto flex w-[min(960px,calc(100%_-_32px))] flex-col items-center px-4 text-center sm:px-0"><MessageCircle className="h-9 w-9 text-guaca-mango-light" /><h2 className="mt-5 text-4xl font-black tracking-[-.055em] sm:text-5xl">{t.businesses.title}</h2><p className="mt-4 max-w-xl text-white/68">{t.businesses.lede}</p><span className="mt-8 inline-flex h-13 items-center rounded-xl border border-dashed border-white/40 bg-white/10 px-7 font-black text-white/85">{t.businesses.comingSoon}</span></div></section>
      </main>

      <footer className="bg-guaca-paper py-10"><div className="mx-auto flex w-[min(1180px,calc(100%_-_32px))] flex-col items-center justify-between gap-5 px-4 text-center sm:flex-row sm:px-0 sm:text-left"><GuacaLogo className="h-11" /><div className="flex flex-col items-center gap-2 sm:items-end"><nav className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-guaca-ink/55"><a href="/privacy" className="underline-offset-2 hover:underline">{t.legal.privacy}</a><a href="/terms" className="underline-offset-2 hover:underline">{t.legal.terms}</a><a href="/delete-account" className="underline-offset-2 hover:underline">{t.legal.deleteAccount}</a></nav><p className="text-xs font-bold text-guaca-ink/45">{t.footer}</p></div></div></footer>
    </div>
  )
}
