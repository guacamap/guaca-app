'use client';

import { useEffect, useState } from 'react';

interface Earning {
  missionId: string;
  brief: string;
  status: string;
  rewardMinor: number;
  currency: string;
  payoutStatus: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function EarningsScreen() {
  const [rows, setRows] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/spotter/earnings`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows: Earning[] }) => setRows(d.rows))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const totalMinor = rows
    .filter((r) => r.payoutStatus === 'sent')
    .reduce((a, r) => a + r.rewardMinor, 0);

  if (loading) return <main className="p">Cargando…</main>;

  return (
    <main className="p">
      <h1>Mis ganancias</h1>
      <p className="total">
        Total pagado: {(totalMinor / 100).toFixed(2)} USD
      </p>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.missionId} className="row">
            <span className="brief">{r.brief}</span>
            <span className="reward">{(r.rewardMinor / 100).toFixed(2)} {r.currency}</span>
            <span className="tag">{r.payoutStatus ?? r.status}</span>
          </li>
        ))}
      </ul>
      <style jsx>{`
        .p { font-family: system-ui, sans-serif; padding: 16px; max-width: 640px; margin: 0 auto; }
        .total { font-weight: 600; }
        .list { list-style: none; padding: 0; }
        .row { display: flex; gap: 10px; justify-content: space-between; border-bottom: 1px solid #eee; padding: 10px 0; }
        .brief { flex: 1; }
        .tag { color: #1d5cb0; }
      `}</style>
    </main>
  );
}
