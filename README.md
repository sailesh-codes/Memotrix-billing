# Memotrix Bill/Receipt Generator & Business Management Web App

Production-ready bill/receipt generator and business management web application for **Memotrix** (Gifts, photo frames, acrylic frames). 
- Contact: Phone `6384241882`, Email `teammemotrix@gmail.com`
- Default Seeded Admin Credentials: Username `admin`, Password `Admin@123456!`

---

## 🌟 Key Features

### 0. Logo Handling
- Default logo `logo-default.png` extracted pixel-for-pixel directly from attached reference invoice image (`media_1788274184174.jpg`).
- Admin upload/replace logo interface (Settings → Business Profile) with client & server-side PNG/JPG/SVG size and dimension validation.

### 1. Reference Bill Layout (Exact Match)
- Top-left header: **Memotrix** bold, phone `6384241882`, email `teammemotrix@gmail.com`. Top-right: Extracted logo.
- Centered green heading **Tax Invoice** separated by green horizontal rule `#0B8A3E`.
- Bill To & Invoice Details row.
- Solid green table header (`#0B8A3E`, white bold text).
- Item discount formatting: `₹100.00 (12.5%)`.
- Total row with centered quantity and total amount in green.
- Invoice Amount In Words converter (`One Thousand and Eighty Rupees only`).
- Numbered Terms and Conditions (Items 1 to 6).
- UPI Click to Pay QR code block.
- Signature area: "For: Memotrix" with bold text **"Executed by: VIYASH S"** (styled text, replacing any handwritten signature).
- Acknowledgment tear-off section below dashed divider line.

### 2. Core Billing & POS Workflow
- Unique sequential bill numbering (`MTX-YYYY-XXXX`).
- Fast product search by name, SKU, or barcode scan.
- Split payments (Cash, UPI w/ QR, Card, Bank Transfer).
- 24-hour edit restriction window with change audit trail.
- Voiding bill requires admin password re-entry + mandatory reason.
- Corporate recurring bill scheduler (`node-cron`).
- Playwright headless Chromium PDF export & print-optimized CSS (`@media print`).

### 3. Authentication & Security
- BCrypt + salt password hashing (min 12-char policy: upper/lower/digit/special).
- Google Authenticator / Authy compatible TOTP 2FA.
- 15-minute inactivity session timeout with warning pop-up modal at 13 minutes (2-minute mark).
- Single session token enforcement: logging in on a new device terminates prior session and triggers security email alert.
- Login audit log with IP geolocation lookup.

### 4. Inventory, Reports & Data Security
- Product CRUD, price tiers (retail, wholesale, corporate), low-stock email triggers.
- Inventory adjustment log history with reason codes (restock, damage, return, audit_correction).
- Recharts sales analytics, top sellers, slow movers, category profit margins.
- GSTR-1 tax liability report summary.
- 1-click Excel (`xlsx`) export & JSON/CSV full raw data portability export.
- AES-256 encrypted database backup service with AWS S3 / GCS cloud target and 90-day retention purge.
- `GET /api/health` monitoring endpoint.

---

## 🚀 Setup & Local Execution Guide

### Option A: Quick Start (Single Command from Root)

Run both Backend API and Frontend concurrently with one command:
```bash
npm run dev
```
- Frontend Web App: `http://localhost:5189`
- Backend REST API: `http://localhost:5000`
- Log in with username `admin` and password `Admin@123456!`

---

### Option B: Separate Local Mode

1. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend API runs on `http://localhost:5000`.

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend App opens on `http://localhost:5189`.

---

### Option B: Production Stack via Docker Compose

```bash
docker compose up -d --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000`
- PostgreSQL: `5432`
- Redis: `6379`

---

### Option C: Vercel Cloud Deployment

1-Click deployment for both Frontend and Backend API (Serverless):
- See complete instructions in [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md).
- Connect repo `sailesh-codes/Memotrix-billing` on Vercel and click **Deploy**.

---

## 📄 Documentation Sitemap
- [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md): 1-click Vercel full-stack & serverless deployment guide
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System design & security architecture
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md): Complete ER diagram & SQL table specifications
- [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md): REST API endpoints reference
- [`docs/UBUNTU_NGINX_DEPLOYMENT.md`](docs/UBUNTU_NGINX_DEPLOYMENT.md): Ubuntu 22.04 LTS & Nginx reverse proxy SSL deployment guide
#   M e m o t r i x - b i l l i n g  
 #   M e m o t r i x - b i l l i n g  