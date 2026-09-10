import helmet from 'helmet';
import cors from 'cors';

export function configureSecurity(app) {
  // Disable Express signature header
  app.disable('x-powered-by');

  // 1. Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:']
        }
      },
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'sameorigin' },
      noSniff: true,
      referrerPolicy: { policy: 'same-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })
  );

  // 2. CORS configuration
  const envAllowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const defaultAllowedOrigins = [
    'https://www.memotrix.in',
    'https://memotrix.in',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5189',
    'http://localhost:3000',
    'http://localhost:5000'
  ];

  const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // Allow any localhost port
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }

        // Allow official Memotrix domain and any subdomains
        if (/^https?:\/\/([a-zA-Z0-9-]+\.)*memotrix\.in$/.test(origin)) {
          return callback(null, true);
        }

        // Allow any Vercel domain (*.vercel.app)
        if (origin.endsWith('.vercel.app') || origin === 'https://vercel.app') {
          return callback(null, true);
        }

        if (allowedOriginsSet.has(origin)) {
          return callback(null, true);
        }

        // Gracefully disallow origin without throwing an unhandled exception
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );
}

export default configureSecurity;
