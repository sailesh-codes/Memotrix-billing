# Vercel Deployment Guide for Memotrix

This project is configured for seamless 1-click deployment on **Vercel**. You can deploy it as a unified full-stack application or as a standalone frontend.

---

## Option 1: Full-Stack Monorepo Deployment (Recommended)

In this mode, Vercel builds the React frontend and deploys the Express backend as a Vercel Serverless Function (`/api/*`).

### 1. Import Repository in Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New" -> "Project"**.
2. Select your repository: `sailesh-codes/Memotrix-billing`.
3. Keep **Root Directory** as `./` (default).
4. Vercel automatically detects the configuration from `vercel.json` and `package.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`

### 2. Configure Environment Variables in Vercel
Under **Project Settings -> Environment Variables**, add:

| Variable | Value / Description | Required |
|---|---|---|
| `JWT_SECRET` | Strong secret string (min 32 chars) | **Yes** |
| `DATABASE_URL` | PostgreSQL connection string (Neon / Supabase / Vercel Postgres) | Recommended for production persistence |
| `ADMIN_ALERT_EMAIL` | `teammemotrix@gmail.com` | Optional |
| `SMTP_HOST` | `smtp.gmail.com` | Optional |
| `SMTP_PORT` | `587` | Optional |
| `SMTP_USER` | `teammemotrix@gmail.com` | Optional |
| `SMTP_PASS` | Gmail 16-character App Password | Optional |

> **Note regarding SQLite on Vercel**: Vercel Serverless Functions have an ephemeral `/tmp` filesystem. While SQLite runs out of `/tmp` for quick testing/demo purposes, for production data persistence we recommend attaching a free managed PostgreSQL database (e.g. Neon, Supabase, or Vercel Postgres) by supplying `DATABASE_URL`.

### 3. Deploy
Click **Deploy**. Your application will be live at `https://<your-project>.vercel.app`.

---

## Option 2: Standalone Frontend Deployment

If you are hosting the backend Express server separately (e.g. on Render, Railway, AWS, or Ubuntu VPS):

1. In Vercel, set **Root Directory** to `frontend`.
2. Vercel will use `frontend/vercel.json` for client-side SPA routing rewrites.
3. Add the following Environment Variable:
   - `VITE_API_URL`: `https://your-backend-api-url.com/api`
4. Click **Deploy**.

---

## Technical Configuration Summary

- `vercel.json`: Configures the root build pipeline, outputs `frontend/dist`, and routes `/api/(.*)` to `/api/index.js` while routing all UI pages `/(.*)` to `/index.html`.
- `api/index.js`: Serverless handler wrapping the Express backend application with auto-seeding.
- `frontend/vercel.json`: Handles SPA routing rewrites when deploying `frontend` as the root directory.
- `package.json`: Root scripts and backend dependencies enabling Vercel serverless function bundling.
- `frontend/src/api/client.js`: Supports dynamic `VITE_API_URL` environment variables with fallback to `/api`.
