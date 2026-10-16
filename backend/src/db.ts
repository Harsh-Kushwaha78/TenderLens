import pg from 'pg';

// Return DATE as 'YYYY-MM-DD' strings (not JS Date) so calendar dates never shift with timezones.
pg.types.setTypeParser(1082, (v: string) => v);
// NUMERIC stays a string by default in node-pg; make that explicit so money is never parsed to float.
pg.types.setTypeParser(1700, (v: string) => v);

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
}

export type Pool = pg.Pool;
export type Queryable = Pick<pg.Pool, 'query'>;
