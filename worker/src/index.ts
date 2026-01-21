/**
 * raj.quest - Cloudflare Worker Entry Point
 * URL redirect and Markdown notes service
 */

import { handleAdmin } from './admin';
import { handleHome, handleGet, handleRaw, handleUnlock } from './redirect';
import { addSecurityHeaders } from './auth';
import type { Env } from './storage';

/**
 * Extract subdomain from hostname if present
 * e.g., "resume.raj.quest" -> "resume"
 * e.g., "raj.quest" -> null
 * e.g., "raj-quest.rajlego.workers.dev" -> null (workers.dev has 3 parts base)
 */
function getSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');

  // Handle workers.dev (base is x.workers.dev = 3 parts)
  if (hostname.endsWith('.workers.dev')) {
    return parts.length > 3 ? parts.slice(0, -3).join('.') : null;
  }

  // Handle custom domains like raj.quest (base is 2 parts)
  // resume.raj.quest -> ["resume", "raj", "quest"]
  if (parts.length > 2) {
    return parts.slice(0, -2).join('.');
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Check for subdomain and convert to path
    // e.g., resume.raj.quest -> raj.quest/resume
    const subdomain = getSubdomain(url.hostname);
    if (subdomain && path === '/') {
      // Subdomain on root path -> use subdomain as key
      path = '/' + subdomain;
    } else if (subdomain && path !== '/') {
      // Subdomain with additional path -> prepend subdomain
      // e.g., resume.raj.quest/raw -> raj.quest/resume/raw
      path = '/' + subdomain + path;
    }

    try {
      let response: Response;

      // Admin routes
      if (path.startsWith('/admin')) {
        response = await handleAdmin(request, env);
        return addSecurityHeaders(response);
      }

      // Home page
      if (path === '/' || path === '') {
        response = await handleHome(request, env);
        return addSecurityHeaders(response);
      }

      // Static assets (favicon, etc.)
      if (path === '/favicon.ico') {
        return new Response(null, { status: 204 });
      }

      // Parse the path to get key and optional suffix
      const pathParts = path.slice(1).split('/');
      const key = pathParts[0];
      const suffix = pathParts[1];

      // Validate key format (alphanumeric, underscore, hyphen only)
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return addSecurityHeaders(
          new Response('Not Found', { status: 404 })
        );
      }

      // Handle different endpoints
      if (suffix === 'raw') {
        // /:key/raw - Get raw content
        response = await handleRaw(request, key, env);
      } else if (suffix === 'unlock' && request.method === 'POST') {
        // /:key/unlock - Unlock password-protected content
        response = await handleUnlock(request, key, env);
      } else if (!suffix) {
        // /:key - Main redirect/note handler
        response = await handleGet(request, key, env);
      } else {
        // Unknown suffix
        response = new Response('Not Found', { status: 404 });
      }

      return addSecurityHeaders(response);
    } catch (error) {
      console.error('Worker error:', error);
      return addSecurityHeaders(
        new Response('Internal Server Error', { status: 500 })
      );
    }
  },
};
