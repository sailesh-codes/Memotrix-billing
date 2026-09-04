import rateLimit from 'express-rate-limit';

// Standard API rate limiter (100 requests per 15 mins)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Strict Login rate limiter (5 failed attempts per 15 mins)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Account temporarily locked for 15 minutes.' }
});

// Graduated OTP Resend Cooldown (60 seconds minimum interval between resends, max 5 per hour)
const resendTimestamps = new Map();

export function resendCooldownMiddleware(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const history = resendTimestamps.get(ip) || { lastResend: 0, hourlyCount: 0, hourStart: now };

  // Reset hourly window if > 1 hour passed
  if (now - history.hourStart > 60 * 60 * 1000) {
    history.hourlyCount = 0;
    history.hourStart = now;
  }

  // 1. Check 60-second minimum cooldown
  const timeSinceLast = now - history.lastResend;
  if (history.lastResend > 0 && timeSinceLast < 60 * 1000) {
    const remainingSecs = Math.ceil((60 * 1000 - timeSinceLast) / 1000);
    return res.status(429).json({
      error: `Please wait ${remainingSecs} seconds before requesting another code.`
    });
  }

  // 2. Check 5 resends per rolling hour cap
  if (history.hourlyCount >= 5) {
    return res.status(429).json({
      error: 'Hourly resend limit reached (5 requests/hour). Please try again in an hour.'
    });
  }

  history.lastResend = now;
  history.hourlyCount += 1;
  resendTimestamps.set(ip, history);
  next();
}

// Strict OTP Request rate limiter (max 3 requests per 15 mins per IP)
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait 15 minutes before requesting another verification code.' }
});

export default {
  apiLimiter,
  loginLimiter,
  otpRequestLimiter,
  resendCooldownMiddleware
};
