'use client';

import { useEffect, useState } from 'react';

interface Mission {
  id: string;
  brief: string;
  targetCategory: string;
  rewardMinor: number;
  currency: string;
  status: string;
  expiresAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SpotterMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/spotter/missions`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { missions: Mission[] }) => setMissions(data.missions))
      .catch(() => setError('No pudimos cargar tus misiones.'))
      .finally(() => setLoading(false));
  }, []);

  async function accept(id: string) {
    const res = await fetch(`${API}/api/spotter/missions/${id}/accept`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return;
    setMissions((m) => m.map((x) => (x.id === id ? { ...x, status: 'accepted' } : x)));
  }

  if (loading) return <main className="p">Cargando…</main>;
  if (error) return <main className="p">{error}</main>;

  return (
    <main className="p">
      <h1>Mis misiones</h1>
      {missions.length === 0 && <p>No tienes misiones todavía.</p>}
      <ul className="missions">
        {missions.map((m) => (
          <li key={m.id} className="mission">
            <p className="brief">{m.brief}</p>
            <p className="reward">
              Recompensa: {(m.rewardMinor / 100).toFixed(2)} {m.currency}
            </p>
            {m.status === 'offered' && (
              <button onClick={() => accept(m.id)}>Aceptar misión</button>
            )}
            {m.status === 'accepted' && <span className="tag">Aceptada</span>}
          </li>
        ))}
      </ul>
      <style jsx>{`
        .p { font-family: system-ui, sans-serif; padding: 16px; max-width: 640px; margin: 0 auto; }
        .missions { list-style: none; padding: 0; }
        .mission { border: 1px solid #ddd; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
        .brief { font-weight: 500; }
        .reward { color: #666; font-size: 14px; }
        button { margin-top: 8px; padding: 8px 14px; border: 0; border-radius: 8px; background: #1d5cb0; color: #fff; cursor: pointer; }
        .tag { color: #1d5cb0; font-weight: 600; }
      `}</style>
    </main>
  );
}
