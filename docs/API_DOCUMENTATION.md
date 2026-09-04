# Memotrix API Documentation

## Auth Endpoints
- `POST /api/auth/login`: Admin login with password and optional TOTP code.
- `POST /api/auth/request-public-reset-code`: Send 6-digit verification code to `teammemotrix@gmail.com` for credential reset.
- `POST /api/auth/reset-password`: Reset admin password using email code + TOTP (if 2FA enabled), clearing `must_reset_password`.
- `POST /api/auth/setup-2fa`: Generate TOTP secret and QR URL.
- `POST /api/auth/enable-2fa`: Verify code and activate 2FA.
- `POST /api/auth/logout`: Invalidate current admin session.
- `GET /api/auth/me`: Get current authenticated user details.

## Billing Endpoints
- `GET /api/bills`: List bills with filters (startDate, endDate, status, customerId).
- `POST /api/bills`: Generate new invoice with items, discounts, split payments, customer_email.
- `GET /api/bills/:id`: Get detailed bill with items, payment summary, and UPI QR Data URI.
- `PUT /api/bills/:id`: Edit bill within 24 hours of creation (invalidates cached PDF on disk).
- `PATCH /api/bills/:id/status`: Update bill payment_status (`paid`, `pending`, `overdue`, `void`) with audit logging (**does not** invalidate cached PDF).
- `POST /api/bills/:id/regenerate-pdf`: Force PDF regeneration and overwrite disk cache on demand.
- `POST /api/bills/:id/void`: Void bill (Requires admin password re-entry + mandatory reason).
- `GET /api/bills/:id/pdf`: Export PDF (serves cached file from disk if available, generates once if missing).

## Settings & Data Export
- `GET /api/settings/business-profile`: Fetch profile info.
- `PUT /api/settings/business-profile`: Update profile & GST breakdown toggle.
- `POST /api/settings/upload-logo`: Upload new logo (PNG/JPG/SVG, < 2MB).
- `GET /api/settings/export-data`: Download raw products, customers, and bills as JSON/CSV.
- `POST /api/settings/backup`: Trigger immediate encrypted backup.
