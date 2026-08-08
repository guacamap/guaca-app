'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { COPY, REPLAY, TERRITORIES, ZONES, type Lang } from '../../lib/copy';
import styles from './landing.module.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const LIVE_TIMEOUT_MS = 2500;

type Status = 'idle' | 'asking' | 'done';

interface Result {
  kind: 'answer' | 'refusal';
  text: string;
  replayed: boolean;
}

/**
 * Content is visible by default; the observer only adds the animated class
 * once JS is running, so a failed observer can never hide a section.
 */
function Reveal({
  children,
  className,
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string | undefined;
  as?: 'div' | 'section' | 'li';
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    el.classList.add('u-observe');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.shown = 'true';
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // @ts-expect-error -- ref type narrows per tag, all are HTMLElement
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>('en');
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const answerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const askRef = useRef<((override?: string) => Promise<void>) | null>(null);
  const deepLinked = useRef(false);

  const t = COPY[lang];

  useEffect(() => {
    const stored = window.localStorage.getItem('guaca-lang');
    if (stored === 'en' || stored === 'es') {
      setLang(stored);
      return;
    }
    if ((navigator.language || 'en').toLowerCase().startsWith('es')) {
      setLang('es');
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
  }, [t.htmlLang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === 'en' ? 'es' : 'en';
      window.localStorage.setItem('guaca-lang', next);
      return next;
    });
  }, []);

  const ask = useCallback(async (override?: string) => {
    const text = (override ?? question).trim();
    if (status === 'asking') return;
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    setStatus('asking');
    setResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

    try {
      const res = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          language: lang,
          lat: 10.4716,
          lon: -68.0056,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { kind: Result['kind']; text: string };
      setResult({ kind: body.kind, text: body.text, replayed: false });
    } catch {
      setResult({
        kind: 'refusal',
        text: REPLAY[lang].text,
        replayed: true,
      });
    } finally {
      clearTimeout(timer);
      setStatus('done');
    }
  }, [question, status, lang]);

  useEffect(() => {
    if (status === 'done' && result) {
      answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status, result]);

  /* A shared or printed link can carry its own question: /?q=… */
  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  useEffect(() => {
    if (deepLinked.current) return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (!q) return;
    deepLinked.current = true;
    setQuestion(q);
    void askRef.current?.(q);
  }, []);

  const refused = result?.kind === 'refusal';

  return (
    <>
      <a className="u-skip" href="#main">
        {t.nav.skip}
      </a>

      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark}>
          {/* The guacamaya is the only colour on the page. It is the mark, not
              ornament, so it sits with the wordmark and nowhere else. */}
          <img
            src="/icon.svg"
            alt=""
            width={32}
            height={32}
            className={styles.mark}
          />
          GUACA
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/map" className={styles.navLink}>
            {t.nav.map}
          </Link>
          <a href="#register" className={styles.navLink}>
            {t.nav.register}
          </a>
          <a href="#spotters" className={styles.navLink}>
            {t.nav.spotters}
          </a>
          <button
            type="button"
            onClick={toggleLang}
            className={styles.langBtn}
            lang={lang === 'en' ? 'es' : 'en'}
          >
            {t.footer.lang}
          </button>
        </nav>
      </header>

      <main id="main">
        {/* ---- Opening plate ---------------------------------------- */}
        <section className={styles.hero}>
          <figure className={styles.heroFigure}>
            <img
              src="/img/coast-2560.webp"
              srcSet="/img/coast-800.webp 800w, /img/coast-1280.webp 1280w, /img/coast-2560.webp 2560w"
              sizes="(max-width: 900px) 100vw, 54vw"
              alt="A Caribbean shoreline at eye level: driftwood on the sand, palms and low structures along the treeline, hazy mountains behind."
              width={2560}
              height={1707}
              fetchPriority="high"
            />
            <figcaption className={styles.heroCaption}>
              <span className="u-micro">{t.hero.caption}</span>
              <span className="u-micro">{t.hero.credit}</span>
            </figcaption>
          </figure>

          <div className={styles.heroBody}>
            <h1 className={`${styles.monument} u-display`}>
              {t.hero.monument}
              <span className={styles.qualifier}>{t.hero.qualifier}</span>
            </h1>

            <p className={styles.lead}>{t.hero.lead}</p>

            <form
              className={styles.ask}
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <label className="u-micro" htmlFor="ask">
                {t.ask.label}
              </label>
              <div className={styles.askRow}>
                <input
                  id="ask"
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t.ask.placeholder}
                  disabled={status === 'asking'}
                  autoComplete="off"
                />
                {/* Never greyed out on an empty field — this is the primary
                    action of the first viewport and it must read as live. */}
                <button type="submit" disabled={status === 'asking'}>
                  {status === 'asking' ? t.ask.working : t.ask.submit}
                </button>
              </div>
              <p className={styles.hint}>{t.ask.hint}</p>
            </form>
          </div>
        </section>

        {/* ---- The answer, resolved in place ------------------------- */}
        {status !== 'idle' && (
          <section
            id="answer"
            ref={answerRef as React.RefObject<HTMLElement>}
            className={`${styles.answer} ${refused ? styles.answerRefused : ''}`}
            aria-live="polite"
          >
            <div className={styles.answerInner}>
              {/* No label above the headline: the refusal sentence and the
                  merlot field already say which state this is, and an eyebrow
                  over a heading is refused outright. */}
              {status === 'asking' ? (
                <p className={`${styles.answerText} u-display`}>
                  {t.ask.working}
                </p>
              ) : (
                <>
                  <p className={`${styles.answerText} u-display`}>
                    {result?.text}
                  </p>

                  {refused && (
                    <div className={styles.commission}>
                      <p>{t.answer.commissionBody}</p>
                    </div>
                  )}

                  <div className={styles.answerFoot}>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => {
                        setStatus('idle');
                        setResult(null);
                        setQuestion('');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        window.setTimeout(() => inputRef.current?.focus(), 600);
                      }}
                    >
                      {t.answer.again}
                    </button>
                    {result?.replayed && (
                      <span className="u-micro">{t.answer.replayNote}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* ---- The loop --------------------------------------------- */}
        <section className={styles.loop} aria-label={t.loop.one}>
          <div className={`${styles.loopPlate} ${styles.loopA}`}>
            <p className="u-display">{t.loop.one}</p>
          </div>
          <div className={`${styles.loopPlate} ${styles.loopB}`}>
            <p className="u-display">{t.loop.two}</p>
          </div>
          <div className={`${styles.loopPlate} ${styles.loopC}`}>
            <p className="u-display">{t.loop.three}</p>
            <p className={styles.loopClose}>{t.loop.close}</p>
          </div>
        </section>

        {/* A quiet full-bleed breath: the coast the register is about. */}
        <div className={styles.band} role="presentation">
          <img
            src="/img/coast-band-2560.webp"
            srcSet="/img/coast-band-1280.webp 1280w, /img/coast-band-2560.webp 2560w"
            sizes="100vw"
            alt=""
            width={2560}
            height={731}
            loading="lazy"
          />
        </div>

        {/* ---- The register ------------------------------------------ */}
        <section id="register" className={styles.register}>
          <div className={styles.registerHead}>
            <h2 className={`${styles.sectionTitle} u-display`}>
              {t.register.statement}
            </h2>
            <p className={`${styles.tally} u-figures`}>
              <strong>1</strong> {t.register.documented}
              <span className={styles.tallyRule} aria-hidden="true" />
              <strong>{TERRITORIES.length}</strong> {t.register.awaiting}
            </p>
          </div>

          {/* The region at country level. The list is deliberately long and
              deliberately unscrolled sideways: the extent of what nobody has
              stood in is the argument, so nothing here hides behind arrows.
              Venezuela is the only country with an area in the database, so
              it is the only one that opens. */}
          <ul className={styles.zones}>
            {TERRITORIES.map((territory, i) => {
              const name = lang === 'es' ? territory.es : territory.en;
              const open = territory.status === 'started';
              return (
                <Reveal
                  as="li"
                  key={territory.en}
                  className={styles.zone}
                  style={{ transitionDelay: `${Math.min(i, 12) * 40}ms` }}
                >
                  <div className={styles.zoneRow}>
                    <span className={`${styles.zoneName} u-display`}>
                      {name}
                    </span>
                    <span
                      className={`${styles.zoneStatus} u-micro ${
                        territory.status === 'started' ? styles.zoneStarted : ''
                      }`}
                    >
                      {territory.status === 'started'
                        ? t.register.started
                        : territory.status === 'next'
                          ? t.register.next
                          : t.register.status}
                    </span>
                  </div>

                  {open && (
                    <div className={styles.area}>
                      <p className={styles.areaHead}>
                        <span className={styles.areaName}>Puerto Cabello</span>
                        <span className="u-micro u-figures">
                          {t.register.zonesOf(0, ZONES.length)}
                        </span>
                      </p>
                      <ul className={styles.areaZones}>
                        {ZONES.map((zone) => (
                          <li key={zone}>
                            <span>{zone}</span>
                            <span className="u-micro">
                              {t.register.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Reveal>
              );
            })}
          </ul>

          <p className={styles.note}>{t.register.note}</p>
        </section>

        {/* ---- The spotters ------------------------------------------ */}
        <section id="spotters" className={styles.spotters}>
          <div className={styles.spottersInner}>
            <p className={`${styles.spottersStatement} u-display`}>
              {t.spotters.statement}
            </p>
            <p className={styles.note}>{t.spotters.note}</p>
          </div>
        </section>

        {/* ---- Close: the page ends on the material it opened with ---- */}
        <section className={styles.close}>
          <img
            className={styles.closeImage}
            src="/img/coast-close-1800.webp"
            alt=""
            width={1800}
            height={1523}
            loading="lazy"
          />
          <div className={styles.closeInner}>
            <h2 className={`${styles.closeMonument} u-display`}>
              {t.close.monument}
            </h2>
            <p className={styles.lead}>{t.close.body}</p>
            <Link href="/map" className={styles.cta}>
              {t.close.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerRow}>
          <span className={styles.wordmark}>GUACA</span>
          <span className="u-micro">{t.footer.rights}</span>
        </div>
        <div className={styles.footerRow}>
          <span className={styles.owners}>
            {t.close.owners}{' '}
            {/* Points at the real QR surface running on a seeded demo token.
                Replace with a signup or contact route once one exists. */}
            <Link href="/v/qr-marina" className={styles.ownersLink}>
              {t.close.ownersLink}
            </Link>
          </span>
        </div>
        <div className={styles.footerRow}>
          <span className="u-micro">{t.footer.photo}</span>
          <button type="button" onClick={toggleLang} className={styles.langBtn}>
            {t.footer.lang}
          </button>
        </div>
      </footer>
    </>
  );
}
