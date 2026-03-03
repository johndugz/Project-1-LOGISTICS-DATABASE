# TOPLIS LOGISTICS – Domestic Forwarding Automation MVP

## Stack
- Backend: Node + Express + TypeScript
- Frontend: React (Vite) + scanner workflow
- Database: PostgreSQL
- Deployment: Docker Compose

## Quick start
```bash
docker compose up --build
```

App URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api

## Seed users
- `admin / password`
- `scanner1 / password`

## Main API
- `POST /api/auth/login`
- `GET /api/bookings` (auth)
- `POST /api/bookings` (auth)
- `POST /api/scan` (auth)
