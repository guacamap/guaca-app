import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { migrate } from '../../src/migrate.js';
import { recordRegistration } from '../../src/registrations.js';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.js';

const DB_NAME = 'guaca_test_registrations';
let pool: Pool;

beforeAll(async () => {
  pool = await createTempDb(DB_NAME);
  const client = await pool.connect();
  try {
    await migrate(client);
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await dropTempDb(DB_NAME, pool);
});

describe('waitlist registrations', () => {
  it('updates one entry when the same contact joins the same role again', async () => {
    const first = await recordRegistration(pool, {
      role: 'traveler',
      name: 'Ana Pérez',
      contact: 'ana@example.com',
      details: { community: 'Aruba', source: 'landing' },
    });
    const second = await recordRegistration(pool, {
      role: 'traveler',
      name: 'Ana Pérez',
      contact: 'ana@example.com',
      details: { community: 'Curaçao', source: 'landing' },
    });

    expect(second.id).toBe(first.id);
    const rows = await pool.query<{ name: string; details: Record<string, unknown> }>(
      `select name, details from registrations
       where role = 'traveler' and lower(contact) = 'ana@example.com'`,
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]).toMatchObject({
      name: 'Ana Pérez',
      details: { community: 'Curaçao', source: 'landing' },
    });
  });

  it('keeps separate entries when one contact joins in different roles', async () => {
    await recordRegistration(pool, {
      role: 'spotter',
      name: 'Ana Pérez',
      contact: 'ana@example.com',
      details: { community: 'Curaçao' },
    });

    const count = await pool.query<{ count: string }>(
      `select count(*)::text as count from registrations where lower(contact) = 'ana@example.com'`,
    );
    expect(count.rows[0]?.count).toBe('2');
  });
});
