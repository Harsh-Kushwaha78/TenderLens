/**
 * DEVELOPMENT-ONLY demo data. Every row is flagged is_demo = TRUE, named "[DEMO] ...", and is hidden
 * from the API unless includeDemo=true. Never run against a database that holds real data you care
 * about in an environment where demo rows would confuse users.
 *   npm run seed:demo            -> insert demo rows (skips if demo rows already exist)
 *   npm run seed:demo -- --reset -> delete ONLY is_demo rows, then insert again
 */
import { loadConfig } from './config.js';
import { createPool } from './db.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data when NODE_ENV=production.');
  process.exit(1);
}

type Demo = [name: string, type: string, client: string, city: string, state: string, budget: string, cont: string | null,
  status: string, startOffset: number, endOffset: number, monthsAgo: number];

const DEMO: Demo[] = [
  ['[DEMO] Corporate Office Renovation', 'building_renovation', 'Demo Client Alpha', 'Ghaziabad', 'Uttar Pradesh', '12500000.00', '750000.00', 'active', -60, 20, 0],
  ['[DEMO] Retail Showroom Fit-out', 'interior_fitout', 'Demo Client Beta', 'New Delhi', 'Delhi', '4800000.00', null, 'active', -30, 75, 1],
  ['[DEMO] Warehouse Electrical Upgrade', 'electrical_works', 'Demo Client Gamma', 'Noida', 'Uttar Pradesh', '2300000.00', '100000.00', 'planning', 10, 120, 1],
  ['[DEMO] School Plumbing Overhaul', 'plumbing_works', 'Demo Client Delta', 'Gurugram', 'Haryana', '1650000.00', null, 'on_hold', -90, -5, 2],
  ['[DEMO] Boundary Wall and Paving', 'civil_works', 'Demo Client Epsilon', 'Faridabad', 'Haryana', '3100000.00', '200000.00', 'draft', 30, 150, 3],
  ['[DEMO] Clinic Interior Refresh', 'interior_fitout', 'Demo Client Zeta', 'Lucknow', 'Uttar Pradesh', '980000.00', null, 'completed', -150, -40, 4],
  ['[DEMO] Hostel Block Repairs', 'building_renovation', 'Demo Client Eta', 'Meerut', 'Uttar Pradesh', '5400000.00', '300000.00', 'planning', 5, 200, 4],
  ['[DEMO] Cancelled Pantry Build', 'other', 'Demo Client Theta', 'Jaipur', 'Rajasthan', '450000.00', null, 'cancelled', -20, 40, 5],
];

const pool = createPool(loadConfig().databaseUrl);
try {
  if (process.argv.includes('--reset')) {
    const del = await pool.query('DELETE FROM projects WHERE is_demo = TRUE');
    console.log(`Deleted ${del.rowCount} demo rows (real rows untouched).`);
  }
  const existing = await pool.query('SELECT count(*)::int AS n FROM projects WHERE is_demo = TRUE');
  if (existing.rows[0].n > 0) {
    console.log('Demo rows already exist; nothing inserted. Use --reset to replace them.');
  } else {
    for (const [name, type, client, city, state, budget, cont, status, s, e, monthsAgo] of DEMO) {
      await pool.query(
        `INSERT INTO projects (name, project_type, client_name, location_city, location_state, description, planned_budget,
            currency, contingency_budget, planned_start_date, target_completion_date, status, is_demo, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'Synthetic demo project. Not real data.',$6,'INR',$7,
            current_date + $8::int, current_date + $9::int, $10, TRUE,
            now() - make_interval(months => $11::int, days => 1), now() - make_interval(months => $11::int, days => 1))`,
        [name, type, client, city, state, budget, cont, s, e, status, monthsAgo],
      );
    }
    console.log(`Inserted ${DEMO.length} demo projects (is_demo = TRUE).`);
  }
} finally {
  await pool.end();
}
