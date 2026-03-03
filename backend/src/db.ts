import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/toplis';

export const pool = new Pool({ connectionString });

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
