# Free Hosting Guide (Neon + Render + Cloudflare Pages)

This guide deploys your MVP with a free stack:

- Database: Neon (PostgreSQL)
- Backend API: Render (Web Service, free tier)
- Frontend dashboard: Cloudflare Pages (free tier)

## 1) Create Neon database (free)

1. Go to Neon dashboard and create a new project.
2. Copy the connection string (`postgres://...`).
3. Keep it ready as `DATABASE_URL`.

## 2) Deploy backend on Render (free)

1. Go to Render dashboard.
2. Create a new **Blueprint** and select this GitHub repository.
3. Render detects `render.yaml` in repo root.
4. Set required environment values in Render:
   - `DATABASE_URL` = Neon connection string
   - `JWT_SECRET` = a strong random value
   - `CORS_ORIGIN` = your frontend URL (from Cloudflare Pages, later)
5. Deploy service.
6. Open: `https://<your-render-service>.onrender.com/health`
   - Should return JSON with `status: OK`.

## 3) Run DB migrations once in Render shell

After first deploy, open Render Shell and run:

```bash
cd backend
npm run migrate
```

## 4) Deploy frontend on Cloudflare Pages (free)

1. Go to Cloudflare Pages dashboard.
2. Connect GitHub repository.
3. Build settings:
   - **Framework preset**: Vite
   - **Root directory**: `frontend`
   - **Build command**: `npm ci && npm run build`
   - **Build output directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL` = `https://<your-render-service>.onrender.com/api`
5. Deploy.

## 5) Finish CORS

Update Render backend environment variable:

- `CORS_ORIGIN` = your Cloudflare Pages URL (e.g. `https://toplis-dashboard.pages.dev`)

Then redeploy backend.

## 6) Notes for free tier

- First request after inactivity can be slow (cold start).
- Local disk is ephemeral on free hosts. Uploaded files in `backend/uploads` may not persist.
- For persistent files, switch to object storage (S3/Supabase Storage/Cloudflare R2).
