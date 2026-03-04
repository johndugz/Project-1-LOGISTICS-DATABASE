# TOPLIS Logistics - Local Development Setup

## Prerequisites

### System Requirements
- **OS**: macOS, Linux, or Windows (WSL2)
- **Docker & Docker Compose**: Latest stable version
- **Node.js**: v20.x LTS
- **npm**: v10.x
- **PostgreSQL**: Optional (if running DB locally)
- **Git**: For version control

### Development Tools (Recommended)
- **VSCode** with extensions:
  - ES7+ React/Redux/React-Native snippets
  - Thunder Client (or Postman)
  - PostgreSQL Client
  - Docker
  - Prettier
  - ESLint

## Quick Start (5 minutes with Docker)

### 1. Clone the Repository

```bash
cd "C:\Users\63905\Desktop\Cyber Security Journey\Project 1\Project-1"
```

### 2. Start All Services

```bash
# Start backend, frontend, database, and MinIO
docker-compose up --build

# Services will be available at:
# Frontend:  http://localhost:3000
# Backend:   http://localhost:5000
# MinIO:     http://localhost:9001
# Postgres:  localhost:5432
```

### 3. Login to Frontend

Navigate to http://localhost:3000

**Demo Credentials:**
- Email: `admin@toplis.com`
- Password: `password`

## Manual Local Development Setup

### Backend Installation

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env (optional for local dev)
# DEFAULTS in .env.example already point to localhost
```

### Database Setup (PostgreSQL locally)

```bash
# Option 1: Using Docker
docker run -d \
  --name toplis-postgres \
  -e POSTGRES_DB=toplis_logistics \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine

# Option 2: Using system PostgreSQL
createdb toplis_logistics
psql toplis_logistics < migrations/*.sql
```

### Run Migrations

```bash
cd backend
npm run migrate

# Verify database
psql -U postgres -d toplis_logistics -c "SELECT version();"
```

### Start Backend Dev Server

```bash
cd backend
npm run dev

# Output: ✓ Server running on http://localhost:5000
```

### Frontend Installation

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Opens automatically at http://localhost:3000
```

## Environment Configuration

### Backend .env (local)

```env
NODE_ENV=development
PORT=5000

# Database (default: localhost PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=toplis_logistics
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=your-dev-secret-key
JWT_EXPIRE=7d

# MinIO (local S3-compatible storage)
USE_MINIO=true
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=toplis-docs

# Development logging
LOG_LEVEL=debug
```

### Frontend .env (optional)

```env
VITE_API_URL=http://localhost:5000/api
```

## Database Management

### Connect to Database

```bash
# Local PostgreSQL
psql -U postgres -d toplis_logistics

# Docker PostgreSQL
docker exec -it toplis-postgres psql -U postgres -d toplis_logistics

# View tables
\dt

# View users
SELECT id, email, role FROM users;

# Exit
\q
```

### Useful Queries

```sql
-- Check all users
SELECT id, email, role, is_active, region FROM users;

-- View recent bookings
SELECT booking_ref, waybill_number, current_status, created_at 
FROM shipments 
ORDER BY created_at DESC 
LIMIT 10;

-- Check audit logs
SELECT user_id, action, resource_type, created_at 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- Count shipments by status
SELECT current_status, COUNT(*) 
FROM shipments 
GROUP BY current_status;
```

## Testing

### Backend Unit Tests

```bash
cd backend
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Frontend Testing (Setup required)

```bash
cd frontend
# Install testing deps (if not included)
npm install --save-dev vitest @testing-library/react

# Run tests
npm test
```

## API Testing

### Using Thunder Client (VSCode Extension)

1. Open Thunder Client in VSCode
2. Import `docs/TOPLIS-Logistics.postman_collection.json`
3. Set base URL to `http://localhost:5000`
4. Login to get token
5. Use token in subsequent requests

### Using cURL

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@toplis.com",
    "password": "password"
  }'

# Save token from response
TOKEN="eyJhbGc..."

# Create booking
curl -X POST http://localhost:5000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipperName": "Test Shipper",
    "shipperAddress": "123 Main St",
    "consigneeName": "Test Consignee",
    "consigneeAddress": "456 Oak Ave",
    "originCity": "Manila",
    "originCountry": "PH",
    "destinationCity": "Cebu",
    "destinationCountry": "PH",
    "mode": "sea",
    "totalPieces": 5,
    "totalWeight": 100,
    "commodityDescription": "Test cargo",
    "estimatedArrival": "2024-03-15T00:00:00Z"
  }'
```

## Debugging

### Backend Debugging (VSCode)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"]
    }
  ]
}
```

Then press F5 to start debugging.

### Frontend React Developer Tools

Install React Developer Tools browser extension:
- Chrome: https://chrome.google.com/webstore
- Firefox: https://addons.mozilla.org

### Logging

```typescript
// Backend
console.log('[DEBUG]', message);
console.error('[ERROR]', error);

// Frontend
console.log('%cThisIsStretched', 'color: green; font-size: 20px');
```

## Common Development Tasks

### Creating a New API Endpoint

1. Create controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. Register route in `backend/src/index.ts`
4. Test with cURL or Postman

Example:

```typescript
// backend/src/controllers/customController.ts
export async function getCustomData(req: Request, res: Response): Promise<void> {
  try {
    const data = await fetchFromDB();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}

// backend/src/routes/custom.ts
router.get('/', authMiddleware, getCustomData);

// backend/src/index.ts
app.use('/api/custom', customRoutes);
```

### Creating a New React Component

1. Create file in `frontend/src/components/` or `frontend/src/pages/`
2. Use TypeScript and Tailwind CSS
3. Import and use in parent component

```typescript
// frontend/src/components/MyComponent.tsx
import React from 'react';

interface MyComponentProps {
  title: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold">{title}</h2>
    </div>
  );
};

export default MyComponent;
```

### Running Database Migrations

```bash
cd backend

# Create new migration
# File: migrations/009_add_new_feature.sql
# Add SQL DDL statements

# Run all migrations
npm run migrate
```

## Performance Profiling

### Backend

```typescript
// Add timing to routes
console.time('database_query');
const result = await pool.query(sql);
console.timeEnd('database_query');
```

### Frontend

Use React Developer Tools Profiler:
1. Open React DevTools
2. Go to Profiler tab
3. Record interaction
4. Analyze performance

## Troubleshooting

### "postgres connection refused"

```bash
# Check if Docker container is running
docker ps | grep postgres

# If not, start it
docker run -d \
  --name toplis-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine
```

### "Port already in use"

```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

### "Cannot find module @zxing/browser"

```bash
cd frontend
npm install @zxing/browser
```

### "JWT token invalid"

- Ensure `JWT_SECRET` matches between backend and requests
- Check token expiry: `JWT_EXPIRE` default is 7 days
- Verify Authorization header format: `Bearer <token>`

### "Cannot read property 'user' of undefined"

- Ensure auth middleware is applied to route
- Check that token is being sent in Authorization header
- Verify user exists in database

## VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.detectIndentation": false,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "files.exclude": {
    "node_modules": true,
    ".next": true,
    "dist": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
git add .
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature-name
```

Commit message format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

## Additional Resources

- Express.js Docs: https://expressjs.com
- React Docs: https://react.dev
- PostgreSQL Docs: https://www.postgresql.org/docs
- TypeScript Docs: https://www.typescriptlang.org/docs
- Docker Docs: https://docs.docker.com
- Tailwind CSS: https://tailwindcss.com/docs

## Need Help?

For issues:
1. Check error messages in terminal
2. Search GitHub Issues repo
3. Check documentation files in `docs/`
4. Create an issue with:
   - Error message
   - Steps to reproduce
   - Environment details
   - Relevant logs

---

Happy coding! 🚀
