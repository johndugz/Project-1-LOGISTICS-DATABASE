import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

function parseDbSsl(): false | { rejectUnauthorized: false } {
  const sslSetting = (process.env.DB_SSL || '').toLowerCase();
  const shouldUseSsl = sslSetting === 'true' || sslSetting === '1' || sslSetting === 'require';

  if (!shouldUseSsl) {
    return false;
  }

  return { rejectUnauthorized: false };
}

const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: parseDbSsl(),
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'toplis_logistics',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: parseDbSsl(),
      }),
});

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Read migration files (migrations directory lives at backend/migrations)
    const migrationsDir = path.join(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn('Migrations directory not found:', migrationsDir);
      return;
    }
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      const { rows } = await client.query('SELECT * FROM migrations WHERE name = $1', [
        migrationName,
      ]);

      if (rows.length === 0) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      }
    }

    console.log('✓ All migrations completed');
  } finally {
    client.release();
  }
}

export function getPool(): Pool {
  return pool;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
