/**
 * Authentication for raj.quest
 * Uses Cloudflare Access for admin authentication
 * Uses PBKDF2 for individual record password protection
 */

import type { Env } from './storage';

// Allowed admin emails (set via environment variable)
// Format: comma-separated list of emails
const ALLOWED_ADMINS_VAR = 'ALLOWED_ADMIN_EMAILS';

/**
 * Hash a password using PBKDF2 (for individual record protection)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt, 0);
  combined.set(new Uint8Array(hash), salt.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));

    const salt = combined.slice(0, 16);
    const originalHash = combined.slice(16);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const newHash = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    // Constant-time comparison
    const newHashArray = new Uint8Array(newHash);
    if (newHashArray.length !== originalHash.length) return false;

    let result = 0;
    for (let i = 0; i < newHashArray.length; i++) {
      result |= newHashArray[i] ^ originalHash[i];
    }

    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Get authenticated user email from Cloudflare Access
 * Returns null if not authenticated via Access
 */
export function getAccessUserEmail(request: Request): string | null {
  // Cloudflare Access adds this header after successful authentication
  return request.headers.get('CF-Access-Authenticated-User-Email');
}

/**
 * Check if user is authenticated via Cloudflare Access
 */
export function isAuthenticated(request: Request, env: Env): boolean {
  const email = getAccessUserEmail(request);
  if (!email) return false;

  // Check against allowed admins list
  const allowedAdmins = (env.ALLOWED_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);

  // If no allowed admins configured, allow any authenticated user
  if (allowedAdmins.length === 0) {
    return true;
  }

  return allowedAdmins.includes(email.toLowerCase());
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         '0.0.0.0';
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
