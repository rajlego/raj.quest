/**
 * raj.quest - Cloudflare Worker Entry Point
 * URL redirect and Markdown notes service
 */

import { handleAdmin } from './admin';
import { handleHome, handleGet, handleRaw, handleUnlock } from './redirect';
import { addSecurityHeaders } from './auth';
import type { Env } from './storage';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      // Admin routes
      if (path.startsWith('/admin')) {
        response = await handleAdmin(request, env);
        return addSecurityHeaders(response);
      }

      // Home page
      if (path === '/' || path === '') {
        response = await handleHome(request);
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
