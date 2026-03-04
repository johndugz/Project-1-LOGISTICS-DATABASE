// Placeholder for migration runner
import { runMigrations } from '../src/config/database';

runMigrations()
  .then(() => {
    console.log('✓ Migrations completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
