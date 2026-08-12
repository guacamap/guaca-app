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
import { Button } from '@/components/ui/button'
import { GuacaLogo } from './GuacaBrand'
import { GuacaMap } from './GuacaMap'
import { PalmFrondLeft } from './GuacaIcons'
import { formatUpdateTime, useInfoStore } from './InfoStore'
const WAITLIST_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSf-y0xwBbCw77P6zTjgxqG6HaGVZCDmRQU-cTvpTB6kNf0_rg/viewform'


const roles = [
  {
    id: 'tourist' as const,
    title: 'Tourist',
    description: 'Plan your day with current local information and experience each Caribbean community like someone who knows it.',
    icon: Compass,
    tone: 'bg-guaca-teal/8 text-guaca-teal',
  },
  {
    id: 'spotter' as const,
    title: 'Spotter',
    description: 'Share what is happening nearby, help your community, and unlock useful local rewards.',
    icon: Camera,
    tone: 'bg-guaca-coral/8 text-guaca-coral-dark',
  },
  {
    id: 'operator' as const,
    title: 'Business',
    description: 'Be visible when locals and travellers are actively looking for what you offer.',
    icon: Store,
    tone: 'bg-guaca-ocean/8 text-guaca-ocean',
  },
]

export function MarketingLanding() {
  const { updates } = useInfoStore()
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
          <a href="#top" className="flex min-h-11 items-center rounded-xl" aria-label="Guaca home">
            <GuacaLogo className="h-[54px] sm:h-[58px]" />
          </a>
          <nav className="ml-auto hidden items-center gap-7 text-[13px] font-bold text-guaca-ink/70 lg:flex" aria-label="Main navigation">
            <a className="landing-link" href="#how">How it works</a>
            <a className="landing-link" href="#live">Live updates</a>
            <a className="landing-link" href="#spotters">Spotters</a>
            <a className="landing-link" href="#waitlist">Waitlist</a>
          </nav>
          <a href="#waitlist" className="ml-auto hidden min-h-11 items-center justify-center rounded-full bg-guaca-teal px-5 text-xs font-extrabold text-white shadow-lg shadow-guaca-teal/20 transition-colors hover:bg-guaca-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-ocean-deep focus-visible:ring-offset-2 sm:inline-flex lg:ml-0">
            Join the waitlist <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
          </a>
          <a href="#waitlist" aria-label="Join the Guaca waitlist" className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-white/80 text-guaca-ocean shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-teal focus-visible:ring-offset-2 sm:hidden">
            <MailPlus aria-hidden="true" className="h-5 w-5" />
          </a>
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
                CARIBBEAN VISION · COMMUNITY-BY-COMMUNITY COVERAGE
              </p>
              <h1 className="mt-6 text-[clamp(3rem,7vw,5.7rem)] font-black leading-[.91] tracking-[-.075em] text-guaca-ocean-deep">
                The Caribbean,<br />
                <span className="guaca-script font-black text-guaca-teal">en tiempo real.</span>
              </h1>
              <div className="landing-scribble mt-3 h-3 w-36" aria-hidden="true" />
              <p className="mt-7 max-w-lg text-base font-medium leading-7 text-guaca-ink/70 sm:text-lg">
                Guaca connects travellers with people on the ground across islands and coastal communities. Discover what is open, plan with current information, and reward the locals who keep each place useful.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button type="button" onClick={() => goToWaitlist()} className="h-13 rounded-xl bg-guaca-teal px-6 text-sm font-extrabold text-white shadow-xl shadow-guaca-teal/20 hover:bg-guaca-teal-dark">
                  <MailPlus aria-hidden="true" className="mr-2 h-4 w-4" /> Join the waitlist
                </Button>
                <span className="inline-flex h-13 items-center justify-center rounded-xl border border-dashed border-guaca-teal/35 bg-white/60 px-6 text-sm font-extrabold text-guaca-teal/75 backdrop-blur">
                  <Smartphone aria-hidden="true" className="mr-2 h-4 w-4" /> App coming soon
                </span>
              </div>
              <div className="mt-7 flex items-center gap-4 text-xs font-bold text-guaca-ink/52">
                <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-guaca-teal" /> Local verification</span>
                <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-guaca-coral" /> Live reports</span>
              </div>
            </div>

            <div className="relative mx-auto h-[560px] w-full max-w-[590px] max-lg:mt-4">
              <div className="landing-phone landing-phone-tourist absolute left-[3%] top-3 h-[520px] w-[260px] overflow-hidden rounded-[42px] border-[8px] border-[#111] bg-guaca-paper shadow-2xl sm:left-[10%]">
                <div className="landing-island" />
                <div className="relative h-[48%] overflow-hidden">
                  <img src="/assets/landing-caribbean-phone.jpg" width="1280" height="2000" alt="Caribbean coverage inside the tourist app" className="h-full w-full object-cover" />
                  {/* Lift the satellite image toward the reference's bright teal sea. */}
                  <div className="absolute inset-0 bg-guaca-teal/28 mix-blend-screen" />
                  <div className="absolute inset-0 bg-gradient-to-b from-guaca-ocean-deep/30 via-transparent to-guaca-ocean-deep/38" />
                  <div className="absolute left-4 right-4 top-9 flex h-10 items-center gap-2 rounded-full bg-white/96 px-4 text-[10px] font-semibold text-guaca-ink/50 shadow-lg"><MapPinned className="h-3.5 w-3.5 text-guaca-teal" /> Ask Guaca about a place…</div>
                  <div className="absolute bottom-4 left-4 rounded-full bg-guaca-ocean-deep/82 px-3 py-1.5 text-[9px] font-black text-white backdrop-blur"><MapIcon className="mr-1 inline h-3 w-3" /> Caribbean communities</div>
                </div>
                <div className="absolute inset-x-0 bottom-0 top-[43%] rounded-t-[28px] bg-guaca-paper px-4 pb-3 pt-5">
                  <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-guaca-teal">Tourist view</p><p className="mt-1 text-[15px] font-black leading-tight text-guaca-ocean-deep">What’s current nearby?</p></div><Compass className="h-6 w-6 text-guaca-teal" /></div>
                  <div className="mt-3 flex gap-1.5"><span className="rounded-full bg-guaca-teal px-2.5 py-1.5 text-[8px] font-black text-white">Updates</span><span className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black text-guaca-ink/48 ring-1 ring-guaca-sand">Plan</span><span className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black text-guaca-ink/48 ring-1 ring-guaca-sand">Stay</span></div>
                  <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-guaca-sand/70">
                  {latestUpdate ? (
                    <div className="flex gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-guaca-teal/10"><Store className="h-5 w-5 text-guaca-teal" /></div>
                      <div className="min-w-0"><p className="truncate text-[8px] font-black text-guaca-teal">{latestUpdate.businessName}{latestUpdate.community ? ` · ${latestUpdate.community}` : ''}</p><p className="mt-1 line-clamp-2 text-[10px] font-black leading-3">{latestUpdate.title}</p><p className="mt-1 text-[7px] font-bold text-guaca-ink/45">{latestUpdate.status === 'verified' ? 'Locally verified' : 'Business-published'}</p></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-guaca-teal/10"><MapPinned className="h-5 w-5 text-guaca-teal" /></div><div><p className="text-[10px] font-black">Coverage grows locally</p><p className="mt-1 text-[8px] leading-3 text-guaca-ink/50">Current information appears as each community joins.</p></div></div>
                  )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[7px] font-black text-guaca-ink/40"><span><MapPinned className="mx-auto mb-1 h-4 w-4 text-guaca-teal" />Map</span><span><Compass className="mx-auto mb-1 h-4 w-4" />Plan</span><span><MessageCircle className="mx-auto mb-1 h-4 w-4" />Updates</span></div>
                </div>
              </div>
              <div className="landing-phone landing-phone-spotter absolute right-[1%] top-16 h-[500px] w-[250px] overflow-hidden rounded-[42px] border-[8px] border-[#111] bg-guaca-paper shadow-2xl sm:right-[6%]">
                <div className="landing-island" />
                <div className="h-48 bg-gradient-to-br from-guaca-teal to-guaca-ocean px-4 pt-9 text-white"><div className="flex items-center"><GuacaLogo variant="reversed" className="h-8" /><span className="ml-auto rounded-full bg-white/14 px-2 py-1 text-[7px] font-black">SPOTTER</span></div><p className="mt-5 text-[9px] font-black uppercase tracking-[.1em] text-white/60">Community verification</p><p className="mt-1 max-w-[180px] text-lg font-black leading-tight">Keep local information useful.</p></div>
                <div className="-mt-3 px-3">
                  <div className="rounded-3xl bg-white p-4 shadow-xl ring-1 ring-guaca-sand/70"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-guaca-coral/10 text-guaca-coral"><ClipboardCheck className="h-5 w-5" /></div>{pendingUpdates.length > 0 && <strong className="rounded-full bg-guaca-mango-light px-2.5 py-1 text-[8px] text-guaca-ink">{pendingUpdates.length} waiting</strong>}</div><p className="mt-4 text-[9px] font-black text-guaca-teal">Review queue</p><p className="mt-1 text-[12px] font-black leading-tight">{pendingUpdates.length > 0 ? 'Local updates need a spotter check.' : 'All caught up in your communities.'}</p><p className="mt-2 text-[8px] leading-3 text-guaca-ink/48">Verify only what you can confirm on the ground.</p><div className="mt-3 flex h-9 items-center justify-center rounded-xl bg-guaca-coral text-[9px] font-black text-white"><BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Review information</div></div>
                  <div className="mt-3 rounded-2xl bg-guaca-teal/7 p-3"><p className="text-[8px] font-black text-guaca-teal">Why it matters</p><p className="mt-1 text-[9px] font-bold leading-3 text-guaca-ink/55">One local check makes an update more useful to every visitor.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="bg-guaca-paper py-24">
          <div className="mx-auto w-[min(1180px,calc(100%_-_32px))] px-4 sm:px-0">
            <div className="text-center"><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-teal">Choose your way in</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Three roles. One connected Caribbean.</h2><p className="mx-auto mt-4 max-w-xl text-guaca-ink/58">Every role strengthens the same local loop wherever Guaca grows: questions become verified updates, and useful updates become better days.</p></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {roles.map(({ id, title, description, icon: Icon, tone }) => (
                <button key={id} type="button" onClick={() => goToWaitlist()} className="group min-h-[290px] rounded-[32px] border border-guaca-sand bg-white p-7 text-left shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guaca-teal focus-visible:ring-offset-2">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${tone}`}><Icon aria-hidden="true" className="h-10 w-10" /></div>
                  <div className="mt-8"><h3 className="text-xl font-black">{title}</h3></div>
                  <p className="mt-3 text-sm font-medium leading-6 text-guaca-ink/60">{description}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm font-black text-guaca-teal">Join as {title}<ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1" /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="live" className="overflow-hidden bg-white py-24">
          <div className="mx-auto grid w-[min(1180px,calc(100%_-_32px))] items-center gap-12 px-4 sm:px-0 lg:grid-cols-2">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-teal">Live information you can trust</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Real updates from<br /><span className="guaca-script text-guaca-teal">real people.</span></h2><p className="mt-5 max-w-lg text-base leading-7 text-guaca-ink/60">From boat schedules to beach conditions, Guaca shows what is happening now and who verified it.</p><div className="mt-8 grid grid-cols-2 gap-3">{[[BadgeCheck,'Verified locally'],[Clock3,'Updated now'],[MapPinned,'Mapped live'],[Users,'Community led']].map(([Icon,label]) => { const FeatureIcon = Icon as typeof BadgeCheck; return <div key={label as string} className="flex min-h-20 items-center gap-3 rounded-2xl bg-guaca-teal/5 p-4"><FeatureIcon className="h-5 w-5 text-guaca-teal" /><span className="text-sm font-black">{label as string}</span></div> })}</div></div>
            <div className="relative min-h-[470px] overflow-hidden rounded-[40px] shadow-2xl ring-1 ring-guaca-ocean-deep/10">
              {/* Pointer events stay off so the page scroll never fights the map. */}
              <div className="pointer-events-none absolute inset-0">
                <GuacaMap pins={[]} mapStyle="streets" center={[-73.5, 15.6]} zoom={3.82} fallbackImage="/assets/landing-caribbean-wide.jpg" />
              </div>
              {/* Warm the street style toward Guaca's turquoise sea. */}
              <div className="pointer-events-none absolute inset-0 bg-guaca-teal/16 mix-blend-multiply" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-guaca-ocean-deep/38 via-transparent to-guaca-teal/12" />
              <div className="absolute left-5 top-5 rounded-full bg-white/90 px-3.5 py-2 text-[10px] font-black uppercase tracking-[.1em] text-guaca-ocean shadow-lg backdrop-blur">
                <MapPinned className="mr-1.5 inline h-3.5 w-3.5 text-guaca-teal" /> The Caribbean, live
              </div>
              <div className="absolute inset-x-5 bottom-5 space-y-3">
                {updates.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/92 p-3.5 shadow-xl backdrop-blur">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-guaca-coral/12 text-guaca-coral"><MapPinned className="h-5 w-5" /></span>
                    <div className="min-w-0"><p className="text-xs font-black text-guaca-ink">Coverage opens community by community</p><p className="mt-0.5 text-[10px] font-semibold text-guaca-ink/50">Business updates appear here the moment they’re published.</p></div>
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
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-lagoon">The heart of Guaca</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Spotters keep the map alive.</h2><p className="mt-5 max-w-lg leading-7 text-white/68">Local knowledge deserves recognition. Missions turn unanswered traveller questions into paid, visible community work.</p><Button type="button" onClick={() => goToWaitlist()} className="mt-8 h-12 rounded-xl bg-guaca-coral px-6 font-black text-white hover:bg-guaca-coral-dark"><Trophy className="mr-2 h-4 w-4" /> Join as a Spotter</Button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-h-64 flex-col rounded-[30px] bg-white/8 p-6">
                <div className="grid flex-1 place-items-center rounded-3xl bg-guaca-coral/14">
                  <Camera aria-hidden="true" className="h-20 w-20 text-guaca-coral-light" strokeWidth={1.5} />
                </div>
                <p className="mt-5 text-center text-lg font-black">Missions with clear rewards</p>
              </div>
              <div className="flex min-h-64 flex-col rounded-[30px] bg-white/8 p-6">
                <div className="grid grid-cols-3 gap-3">
                  {[Award, Gift, Medal].map((RewardIcon, index) => (
                    <div key={index} className="grid aspect-square place-items-center rounded-2xl bg-white/10 text-guaca-mango-light">
                      <RewardIcon aria-hidden="true" className="h-8 w-8" strokeWidth={1.6} />
                    </div>
                  ))}
                </div>
                <p className="mt-auto pt-7 text-lg font-black">Rewards that recognise real impact</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-white/65"><Gift aria-hidden="true" className="h-4 w-4" /> Gear, badges, local experiences</div>
              </div>
            </div>
          </div>
        </section>

        <section id="waitlist" className="scroll-mt-4 bg-guaca-teal py-24 text-white">
          <div className="mx-auto grid w-[min(1080px,calc(100%_-_32px))] items-center gap-12 px-4 sm:px-0 lg:grid-cols-[.85fr_1.15fr]">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-guaca-mango-light">Join the first communities</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl">Help decide where Guaca grows next.</h2><p className="mt-5 max-w-lg leading-7 text-white/76">Tell us your role and the Caribbean community that matters to you. We’ll use the waitlist to prioritise real local demand—not pretend the whole region is already covered.</p><div className="mt-8 space-y-3 text-sm font-bold text-white/80">{[['01','Choose your role'],['02','Name your community'],['03','Hear from us when coverage is ready']].map(([number,label]) => <div key={number} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-[10px] text-guaca-mango-light">{number}</span><span>{label}</span></div>)}</div></div>
            <div className="flex flex-col justify-center gap-6 rounded-[32px] bg-white/10 p-8 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-sm font-bold leading-6 text-white/80">
                The waitlist runs on a short form — your role, your community,
                about a minute.
              </p>
              <a
                href={WAITLIST_FORM_URL}
                className="inline-flex h-14 items-center justify-center rounded-xl bg-white px-8 text-sm font-extrabold text-guaca-ocean-deep shadow-xl transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-guaca-teal"
              >
                Open the waitlist form <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </a>
              <p className="text-xs font-semibold text-white/55">Opens Google Forms</p>
            </div>
          </div>
        </section>

        <section id="businesses" className="bg-guaca-ocean-deep py-20 text-white"><div className="mx-auto flex w-[min(960px,calc(100%_-_32px))] flex-col items-center px-4 text-center sm:px-0"><MessageCircle className="h-9 w-9 text-guaca-mango-light" /><h2 className="mt-5 text-4xl font-black tracking-[-.055em] sm:text-5xl">Want to see how the product works?</h2><p className="mt-4 max-w-xl text-white/68">The tourist, spotter, and business experiences are almost ready — opening as community coverage grows.</p><span className="mt-8 inline-flex h-13 items-center rounded-xl border border-dashed border-white/40 bg-white/10 px-7 font-black text-white/85">App preview coming soon</span></div></section>
      </main>

      <footer className="bg-guaca-paper py-10"><div className="mx-auto flex w-[min(1180px,calc(100%_-_32px))] flex-col items-center justify-between gap-5 px-4 text-center sm:flex-row sm:px-0 sm:text-left"><GuacaLogo className="h-11" /><p className="text-xs font-bold text-guaca-ink/45">The Caribbean, mapped by the people who know it.</p></div></footer>
    </div>
  )
}
