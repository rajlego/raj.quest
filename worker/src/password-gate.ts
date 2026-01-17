/**
 * Password protection for individual records
 */

import { verifyPassword, getClientIP } from './auth';
import type { StoredRecord, Env } from './storage';

const UNLOCK_COOKIE_PREFIX = 'raj_quest_unlock_';
const UNLOCK_DURATION_HOURS = 1;

// Rate limiting for unlock attempts
const unlockRateLimitMap = new Map<string, { attempts: number; resetAt: number }>();
const MAX_UNLOCK_ATTEMPTS = 10;
const UNLOCK_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get unlock cookie for a specific key
 */
export function getUnlockCookie(request: Request, key: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookieName = `${UNLOCK_COOKIE_PREFIX}${key}`;
  const cookies = cookieHeader.split(';').map(c => c.trim());

  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === cookieName) {
      return value;
    }
  }

  return null;
}

/**
 * Create unlock cookie for a specific key
 */
export function createUnlockCookie(key: string): string {
  const maxAge = UNLOCK_DURATION_HOURS * 60 * 60;
  const cookieName = `${UNLOCK_COOKIE_PREFIX}${key}`;
  // Simple token - just needs to exist, actual validation is that cookie exists
  const token = crypto.randomUUID();
  return `${cookieName}=${token}; Path=/${key}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/**
 * Check if user has valid unlock cookie for a key
 */
export function isUnlocked(request: Request, key: string): boolean {
  return getUnlockCookie(request, key) !== null;
}

/**
 * Check rate limit for unlock attempts
 */
export function checkUnlockRateLimit(
  ip: string,
  key: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const rateLimitKey = `${ip}:${key}`;
  const entry = unlockRateLimitMap.get(rateLimitKey);

  // Clean up expired entries
  if (entry && entry.resetAt < now) {
    unlockRateLimitMap.delete(rateLimitKey);
  }

  const current = unlockRateLimitMap.get(rateLimitKey);

  if (!current) {
    return { allowed: true };
  }

  if (current.attempts >= MAX_UNLOCK_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/**
 * Record an unlock attempt
 */
export function recordUnlockAttempt(ip: string, key: string): void {
  const now = Date.now();
  const rateLimitKey = `${ip}:${key}`;
  const entry = unlockRateLimitMap.get(rateLimitKey);

  if (!entry || entry.resetAt < now) {
    unlockRateLimitMap.set(rateLimitKey, {
      attempts: 1,
      resetAt: now + UNLOCK_RATE_LIMIT_WINDOW_MS,
    });
  } else {
    entry.attempts++;
  }
}

/**
 * Clear unlock rate limit
 */
export function clearUnlockRateLimit(ip: string, key: string): void {
  const rateLimitKey = `${ip}:${key}`;
  unlockRateLimitMap.delete(rateLimitKey);
}

/**
 * Get the password prompt HTML page
 */
export function getPasswordPromptHTML(key: string, error?: string): string {
  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Protected Content - raj.quest</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .container {
      max-width: 400px;
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 2rem;
    }
    h1 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .subtitle {
      color: #888;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .error {
      background: #3d1f1f;
      border: 1px solid #6b2c2c;
      color: #f87171;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    label {
      font-size: 0.875rem;
      color: #aaa;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      background: #0a0a0a;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      font-size: 1rem;
      margin-top: 0.25rem;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #666;
    }
    button {
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #2563eb;
    }
    .back-link {
      display: block;
      text-align: center;
      margin-top: 1rem;
      color: #666;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .back-link:hover {
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Protected Content</h1>
    <p class="subtitle">This content requires a password to access.</p>
    ${errorHtml}
    <form method="POST" action="/${escapeHtml(key)}/unlock">
      <div>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit">Unlock</button>
    </form>
    <a href="/" class="back-link">Back to raj.quest</a>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char]);
}

/**
 * Verify password for a record
 */
export async function verifyRecordPassword(
  password: string,
  record: StoredRecord
): Promise<boolean> {
  if (!record.passwordHash) return true;
  return await verifyPassword(password, record.passwordHash);
}
