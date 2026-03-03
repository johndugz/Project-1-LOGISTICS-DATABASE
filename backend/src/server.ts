import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { query } from './db';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/', (_req, res) => {
  res.send('TOPLIS Logistics API running');
});

app.listen(PORT, async () => {
  try {
    await query('SELECT 1');
    console.log(`API listening on :${PORT} and database connected.`);
  } catch (e) {
    console.error('API started but DB connection failed', e);
  }
});
