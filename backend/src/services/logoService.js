import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..', '..');

// 4,700-byte official Memotrix site logo embedded as base64 fail-safe
export const MEMOTRIX_DEFAULT_LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAFcAAAA3CAIAAAD2XkFhAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAARD0lEQVR4nO1bW4xVVZpet30/1zpUUVgoNDaII9B2JENEZqQ16pCB6dHCYUxMWjPpYELijL6QEH0eu51O8Do+OGkvrYZIK4zYalpGiQLqCDRkbHvoAoYqSiyqTp3bvu91may1qo6lTVGFBeGh/etkZ3H2Pnvt9a3/+v0bKIQAf/aC/uwRkPIdCt+hMC7f6cJ3KIzLd7rwHQoXRBdqtRpjLMsy3/eFEENDQwCALMvO8ZM4jvWAMRYEAWNMJyxZlnHOAQCUUn0NY6zRaLR/kikBACRJMjIyAgAYHBzUt2q1WkIIznn7bhOTIMbYlAuBM8maGGNhGHqeByGMogghZNt2s9ksFAqT/SRNU0KIfjKEEMZY/1A/hmmaCKFms5llWaVS0acsy2KMQQgRQhophFCj0WCM5XI50zTTNDVNk3OOkNxUrgQEUIwxgghF1EXMMaEEL0PlmVBCIeHh88BQXuXoBI9xhiHYWgr0budz+cZY5xzx3H0N1mW6RUGQaBVQwjR0dFhGEa1WtUKEobhWSfSPzy3TAHSuSWKIsMwGGOtVqtSqWCMK5WKEAJCOBkEQgi9S5TSLMsIIaYSAIDv+4SQJEkghBhjveGccyEExjiOY8YYQsh13Uajkcvl9Ibrn2vU4jg2DKOtBfpJJnuYC6YLCCEIoWmaWsmHhoYQQmmaTnY9pVQrZ5qmjDHLsjjnZ86cabVa+gLbtpMkMU2zUqk0Go1isVgul4MgMAzDtm3XdQkhIyMjnucRQkZHR+v1ej6fP3HiRBAEnPNWq6VB1PvPlExnITPSBb1jlNJisSiEeOGFFzjnmzdvnux6bTjan7muixCqVqv79u374IMPFi9enMvl1q9f32q19u7d22q1siyjlHZ2diKEFi5c2NnZmcvlLMvSbtL3/SAITp48CQB4/vnnb7vttvnz58+bN+/bLWRGKGjHE8dxLpcDANTr9a1bt65evXrFihVnvb6tqEQJpbSvr2///v1PP/304OBgsVjUCrJmzZokSV5++WXf95cuXXrttddq66hWqzklaZp6nlcqlYQQ+/fvX7Zs2Q033NDT0+P7vmEYei6tEdMxh5lahKns2fM8SikAYOPGjRjjp556arLrCSFpmgohCoWCYRjDw0PHj/3x1Kl+CEWpVAiCQNtCs9k0Tau3t/fUqVPHjh1rtRpRFNi22dnZiTHWUcYwjCRJLMs6fPjw2rVre3p66vW6NhkdF9ruSYeVi4gCVH4+jmOMsRCiXC4/8cQTL7740qf//TvOAGPSS0dRAAAXnAIB+v/vpGVafjOoj9YA4L95842//7s1nmcgzBASnFNt1aZpN+p+Pl+4++67f//7/9n/0d6MJpZlBEFLCGYY0gzjOOac79y585ZbblmwYAFjrFQq6c3XzhVjPLbCacSIGaGQZZmeUs8dBAFCaMmSJY8//jjnMqoBwG3bZlxlRJDPmz//1MCg67oyBUhSBAQA3PfraUIpS0slqSBZxgxi5vM5xvjSpUsXXfX99957r16v+YHveY5lWWEYUkpt23733XdLpdL111+vg8g0HeGFR4F/XdlarVYul7vzzjtfeuml/fv35/M53/e/UkshspR2dXUZJoEQvvba9ltuudnJuR2V8rz5s0eqZ8IoiKIgSRLld2VAAQDcdNNN3d3dO3fuTJIkk7E1c92cdi59fX233nqr9tAjIyPTdAEXHgWiwh5jjFKqw3WpVNqwYcOcOXMee+wxCCUulFIsU0RpMio7MOIoabVajUZj7hVXpHF0zz33PPzww7O7OiEUruvmcq5eDqW0VqvN7prT29vb39//8ccfR2HCmLR2Sunu3bvXrFmj1aper5fL5elo/kVBAU2YWIdMCOFVVy3ctGnTr1/79Qcf7O3q6kIIJWmCFAoQAca47Vi73vzPv77xr+LQNwzywx/+4Mc/Xgel86AQSlfCOONCQlwoFOI47unpuf32O977rz3Hjx83DCOKktHR0TiOF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';

export const MEMOTRIX_DEFAULT_LOGO_BUFFER = Buffer.from(MEMOTRIX_DEFAULT_LOGO_BASE64, 'base64');

/**
 * Resolves a reliable binary Buffer for invoice PDF generation.
 * Guarantees that dummy/corrupt/tiny data URIs (e.g. 1x1 transparent PNGs)
 * are rejected in favor of the real site logo.
 * 
 * @param {string} [logoOriginalUrl]
 * @param {string} [logoUrl]
 * @returns {Buffer}
 */
export function resolveLogoBuffer(logoOriginalUrl, logoUrl) {
  const candidates = [logoOriginalUrl, logoUrl];

  for (const cand of candidates) {
    if (!cand || typeof cand !== 'string') continue;
    const trimmed = cand.trim();
    if (!trimmed) continue;

    // Check Data URI
    if (trimmed.startsWith('data:image/')) {
      try {
        const b64 = trimmed.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const buf = Buffer.from(b64, 'base64');
        // Real brand logos are at least 200 bytes; 1x1 dummy pixels are ~68 bytes
        if (buf.length >= 200) {
          return buf;
        }
      } catch (e) {}
      continue;
    }

    // Check File System Paths
    const clean = trimmed.split('?')[0].replace(/^\//, '');
    if (clean === 'uploads/logo_serverless.png') {
      continue; // Skip known placeholder
    }

    const candidatePaths = [
      trimmed,
      path.join(backendDir, clean),
      path.join(backendDir, 'public', clean),
      path.join(backendDir, 'public', 'uploads', path.basename(clean)),
      path.join(backendDir, 'assets', clean),
      path.join(backendDir, '..', 'frontend', 'public', clean),
      path.join(backendDir, '..', 'frontend', 'dist', clean),
      path.join(process.cwd(), clean),
      path.join(process.cwd(), 'public', clean),
      path.join(process.cwd(), 'assets', clean),
      path.join(process.cwd(), 'frontend', 'public', clean)
    ];

    for (const p of candidatePaths) {
      try {
        if (p && fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
          const buf = fs.readFileSync(p);
          if (buf.length >= 200) {
            return buf;
          }
        }
      } catch (e) {}
    }
  }

  // Fallback to disk default logo
  const defaultDiskPaths = [
    path.join(backendDir, 'assets', 'logo-default.png'),
    path.join(backendDir, 'public', 'logo-default.png'),
    path.join(backendDir, '..', 'frontend', 'public', 'logo-default.png'),
    path.join(backendDir, '..', 'frontend', 'dist', 'logo-default.png'),
    path.join(process.cwd(), 'assets', 'logo-default.png'),
    path.join(process.cwd(), 'public', 'logo-default.png'),
    path.join(process.cwd(), 'frontend', 'public', 'logo-default.png')
  ];

  for (const p of defaultDiskPaths) {
    try {
      if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
        const buf = fs.readFileSync(p);
        if (buf.length >= 200) {
          return buf;
        }
      }
    } catch (e) {}
  }

  // Ultimate fail-safe (works even in isolated serverless execution)
  return MEMOTRIX_DEFAULT_LOGO_BUFFER;
}

/**
 * Resolves a reliable Data URI string for HTML templates or client rendering.
 * 
 * @param {string} [logoOriginalUrl]
 * @param {string} [logoUrl]
 * @returns {string}
 */
export function resolveLogoDataUri(logoOriginalUrl, logoUrl) {
  const buf = resolveLogoBuffer(logoOriginalUrl, logoUrl);
  // Detect MIME type from header magic bytes
  let mimeType = 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    mimeType = 'image/jpeg';
  } else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    mimeType = 'image/gif';
  } else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    mimeType = 'image/webp';
  }
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}

export default {
  MEMOTRIX_DEFAULT_LOGO_BASE64,
  MEMOTRIX_DEFAULT_LOGO_BUFFER,
  resolveLogoBuffer,
  resolveLogoDataUri
};
