'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './villa.module.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function VillaLanding({ qrToken }: { qrToken: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState('');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [messages, setMessages] = useState<
    Array<{ role: string; kind?: string; text: string }>
  >([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const detected = (navigator.language || 'en').startsWith('es') ? 'es' : 'en';
    setLang(detected);
    fetch(`${API}/api/v/${qrToken}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: detected }),
    })
      .then((r) => r.json())
      .then((d: { sessionId: string; propertyName: string }) => {
        setSessionId(d.sessionId);
        setPropertyName(d.propertyName);
      })
      .catch(() => undefined);
  }, [qrToken]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const t =
    lang === 'es'
      ? {
          tagline: 'Conocimiento local, atestiguado y no inferido.',
          placeholder: 'Pregunta sobre Puerto Cabello…',
          submit: 'Preguntar',
          working: 'Preguntando',
          empty: 'Pregunta por un lugar de por aquí. Si nadie lo ha documentado, te lo dirá.',
          error: 'El servicio no responde ahora mismo. Intenta de nuevo en un momento.',
          refused: 'No documentado',
          answered: 'Documentado',
        }
      : {
          tagline: 'Local knowledge, witnessed not inferred.',
          placeholder: 'Ask about Puerto Cabello…',
          submit: 'Ask',
          working: 'Asking',
          empty: 'Ask about a place near here. If nobody has documented it, it will say so.',
          error: 'The service is unreachable right now. Try again shortly.',
          refused: 'Not documented',
          answered: 'Documented',
        };

  async function ask() {
    if (!question.trim() || busy || !sessionId) return;
    const text = question.trim();
    setQuestion('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text }]);
    try {
      const res = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          language: lang,
          lat: 10.4716,
          lon: -68.0056,
          sessionId,
        }),
      });
      const body = (await res.json()) as { kind: string; text: string };
      setMessages((m) => [
        ...m,
        { role: 'assistant', kind: body.kind, text: body.text },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', kind: 'refusal', text: t.error },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.villa}>
      <header className={styles.header}>
        <h1 className={styles.property}>{propertyName || 'GUACA'}</h1>
        <span className="u-micro">{t.tagline}</span>
      </header>

      <div ref={scrollRef} className={styles.chat}>
        {messages.length === 0 && <p className={styles.empty}>{t.empty}</p>}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.msg} ${m.role === 'user' ? styles.user : ''} ${
              m.kind === 'refusal' ? styles.refusal : ''
            }`}
          >
            {m.role === 'assistant' && (
              <span className="u-micro">
                {m.kind === 'refusal' ? t.refused : t.answered}
              </span>
            )}
            <p className={styles.bubble}>{m.text}</p>
          </div>
        ))}
        {busy && (
          <div className={styles.msg}>
            <p className={styles.bubble}>…</p>
          </div>
        )}
      </div>

      <form
        className={styles.field}
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.placeholder}
          disabled={!sessionId || busy}
          aria-label={t.placeholder}
          autoComplete="off"
        />
        <button type="submit" disabled={!sessionId || busy}>
          {busy ? t.working : t.submit}
        </button>
      </form>
    </main>
  );
}
