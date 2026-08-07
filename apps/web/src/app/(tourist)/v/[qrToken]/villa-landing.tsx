'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function VillaLanding({ qrToken }: { qrToken: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const lang = (navigator.language || 'en').startsWith('es') ? 'es' : 'en';
    fetch(`${API}/api/v/${qrToken}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: lang }),
    })
      .then((r) => r.json())
      .then((d: { sessionId: string; propertyName: string }) => {
        setSessionId(d.sessionId);
        setPropertyName(d.propertyName);
      })
      .catch(() => undefined);
  }, [qrToken]);

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
        body: JSON.stringify({ text, language: 'en', lat: 10.4716, lon: -68.0056, sessionId }),
      });
      const body = (await res.json()) as { kind: string; text: string };
      setMessages((m) => [...m, { role: 'assistant', text: body.text }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="villa">
      <header>
        <strong>{propertyName || 'GUACA'}</strong>
        <span>Local knowledge, witnessed not inferred.</span>
      </header>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="bubble">…</div></div>}
      </div>
      <div className="input">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask about Puerto Cabello…"
          disabled={!sessionId || busy}
        />
        <button onClick={ask} disabled={!sessionId || busy}>Ask</button>
      </div>
      <style jsx>{`
        .villa { font-family: system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; }
        header { padding: 14px 16px; border-bottom: 1px solid #ddd; display: flex; gap: 10px; align-items: baseline; }
        header span { color: #666; font-size: 13px; }
        .chat { flex: 1; overflow-y: auto; padding: 14px; }
        .msg { margin-bottom: 10px; }
        .msg.user { text-align: right; }
        .bubble { display: inline-block; padding: 8px 12px; border-radius: 12px; background: #eee; max-width: 85%; text-align: left; white-space: pre-wrap; }
        .msg.user .bubble { background: #dbeafe; }
        .input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; }
        .input input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
        .input button { padding: 10px 16px; border: 0; border-radius: 8px; background: #1d5cb0; color: #fff; cursor: pointer; }
      `}</style>
    </main>
  );
}
