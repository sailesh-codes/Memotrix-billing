# Access Control & Security Specification

## Single Permanent Admin Account Architecture
This system is configured with **exactly one permanent Admin account**:
- **Fixed Email**: `teammemotrix@gmail.com`
- **Fixed Username**: `admin`
- **Role**: `admin`

> [!IMPORTANT]
> The previous multi-tenant super-admin / tenant-admin hierarchy has been superseded. No mechanism exists anywhere in the application or API to provision additional admin accounts.

---

## 1. Immutable Email (`teammemotrix@gmail.com`)
The admin email address is permanent and cannot be modified under any circumstances:
- **Database Layer**: Locked to `teammemotrix@gmail.com` in seed and schema constraints.
- **API Layer**: `PUT /api/settings/business-profile` explicitly checks and rejects any email modification attempt with `403 Forbidden: Email address cannot be modified`.
- **UI Layer**: Rendered as a disabled, read-only field in **Settings → Business Profile**.

---

## 2. 3-Factor Verified Password Changes
The only mutable credential is the admin password. Password updates require multi-factor identity verification:
1. **Current Password Re-entry**: Standard password validation.
2. **One-Time Email Verification Code**: A 6-digit one-time code sent to `teammemotrix@gmail.com` via `emailService.js`.
3. **Current TOTP 2FA Code**: Required if 2FA is active on the account.

---

## 3. Session Security
- **Single Active Session**: Logging in on a new device invalidates prior session tokens and sends a security alert email.
- **15-Minute Inactivity Timeout**: Automatic logout with a 2-minute warning pop-up at 13 minutes.
- **Audit Logging**: Every login and password change attempt is logged to `login_audit_logs`.

---

## 4. Web Application Security & Exposure Audit Checklist

### Server-Side Data Protection
- **Secrets Server-Side**: Connection strings, `JWT_SECRET`, `ENCRYPTION_KEY`, and SMTP credentials live strictly in server environment variables (`.env`). `.env` is listed in `.gitignore`.
- **API Response Sanitization**: API endpoints shape JSON output explicitly, stripping `password_hash`, `totp_secret`, or raw internal secrets.
- **Field Encryption**: PII (`phone`, `email`, `gstin`) and payment references are encrypted at rest with AES-256-GCM (`cryptoService.js`).

### Security Headers (`helmet` middleware)
- `Strict-Transport-Security` (HSTS): `max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` (CSP): Restricts scripts, styles, images, and connect sources.
- `X-Frame-Options`: DENY / SAMEORIGIN clickjacking mitigation.
- `X-Content-Type-Options`: `nosniff` MIME-type sniffing defense.

### Pre-Deployment Audit Checklist
1. **DevTools Sources**: Confirm no hardcoded API keys or secrets in React JS bundles.
2. **Network Tab**: Inspect Fetch/XHR responses to ensure password hashes and internal keys are never transmitted.
3. **Error Handling**: Verify Express global error handlers catch exceptions and return generic messages (`Internal Server Error`), logging detailed stack traces server-side via Winston.
