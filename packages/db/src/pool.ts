import pg from 'pg';

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca',
});
