/**
 * Public redirect and notes handlers
 */

import { marked } from 'marked';
import { getRecord, type Env, type StoredRecord } from './storage';
import {
  isUnlocked,
  getPasswordPromptHTML,
  verifyRecordPassword,
  checkUnlockRateLimit,
  recordUnlockAttempt,
  clearUnlockRateLimit,
  createUnlockCookie,
} from './password-gate';
import { getClientIP, addSecurityHeaders } from './auth';

// Small delay to prevent timing attacks on key enumeration
const RESPONSE_DELAY_MS = 50;

/**
 * Add a small delay to responses to prevent timing attacks
 */
async function addResponseDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, RESPONSE_DELAY_MS));
}

/**
 * Render markdown to HTML with template
 */
function renderMarkdown(content: string, title: string): string {
  const htmlContent = marked.parse(content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - raj.quest</title>
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
      line-height: 1.6;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #fff;
    }
    h1:first-child {
      margin-top: 0;
    }
    p {
      margin-bottom: 1em;
    }
    pre {
      background: #1a1a1a;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin-bottom: 1em;
    }
    code {
      background: #1a1a1a;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 3px solid #333;
      padding-left: 1rem;
      margin: 1em 0;
      color: #aaa;
    }
    ul, ol {
      margin-bottom: 1em;
      padding-left: 2em;
    }
    li {
      margin-bottom: 0.25em;
    }
    hr {
      border: none;
      border-top: 1px solid #333;
      margin: 2em 0;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
    }
    th, td {
      border: 1px solid #333;
      padding: 0.5rem;
      text-align: left;
    }
    th {
      background: #1a1a1a;
    }
    .back-link {
      display: inline-block;
      margin-top: 2rem;
      color: #666;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <article>
    ${htmlContent}
  </article>
  <a href="/" class="back-link">&larr; raj.quest</a>
</body>
</html>`;
}

/**
 * Get 404 response (consistent to prevent enumeration)
 */
async function get404Response(): Promise<Response> {
  await addResponseDelay();

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found - raj.quest</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
    }
    h1 {
      font-size: 3rem;
      color: #fff;
      margin-bottom: 0.5rem;
    }
    p {
      color: #666;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>This page doesn't exist.</p>
    <p><a href="/">Go to raj.quest</a></p>
  </div>
</body>
</html>`,
    {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

/**
 * Escape HTML
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
 * Handle GET request for a key
 */
export async function handleGet(
  request: Request,
  key: string,
  env: Env
): Promise<Response> {
  const record = await getRecord(env.REDIRECTS, key);

  if (!record) {
    return get404Response();
  }

  // Check if password-protected
  if (record.passwordHash && !isUnlocked(request, key)) {
    await addResponseDelay();
    return new Response(getPasswordPromptHTML(key), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  await addResponseDelay();

  if (record.type === 'uri') {
    return Response.redirect(record.content, 302);
  } else if (record.type === 'note') {
    return new Response(renderMarkdown(record.content, key), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return get404Response();
}

/**
 * Handle raw content request
 */
export async function handleRaw(
  request: Request,
  key: string,
  env: Env
): Promise<Response> {
  const record = await getRecord(env.REDIRECTS, key);

  if (!record) {
    return get404Response();
  }

  // Check if password-protected
  if (record.passwordHash && !isUnlocked(request, key)) {
    await addResponseDelay();
    return new Response('Unauthorized', { status: 401 });
  }

  await addResponseDelay();

  return new Response(record.content, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Handle unlock attempt
 */
export async function handleUnlock(
  request: Request,
  key: string,
  env: Env
): Promise<Response> {
  const ip = getClientIP(request);

  // Check rate limit
  const rateLimit = checkUnlockRateLimit(ip, key);
  if (!rateLimit.allowed) {
    await addResponseDelay();
    return new Response(
      getPasswordPromptHTML(key, `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`),
      {
        status: 429,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': String(rateLimit.retryAfter),
        },
      }
    );
  }

  const record = await getRecord(env.REDIRECTS, key);

  // Return 404 for non-existent keys (consistent with other responses)
  if (!record) {
    return get404Response();
  }

  // If not password-protected, just redirect to the key
  if (!record.passwordHash) {
    return Response.redirect(`/${key}`, 302);
  }

  // Parse form data
  const formData = await request.formData();
  const password = formData.get('password') as string;

  if (!password) {
    await addResponseDelay();
    return new Response(getPasswordPromptHTML(key, 'Password is required.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Verify password
  const isValid = await verifyRecordPassword(password, record);

  if (!isValid) {
    recordUnlockAttempt(ip, key);
    await addResponseDelay();
    return new Response(getPasswordPromptHTML(key, 'Incorrect password.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Password correct - clear rate limit and set cookie
  clearUnlockRateLimit(ip, key);

  const headers = new Headers();
  headers.set('Set-Cookie', createUnlockCookie(key));
  headers.set('Location', `/${key}`);

  return new Response(null, {
    status: 302,
    headers,
  });
}

/**
 * Handle home page
 */
export async function handleHome(request: Request, env: Env): Promise<Response> {
  // Check for root redirect in KV
  const rootRecord = await getRecord(env.REDIRECTS, '_root');
  if (rootRecord && rootRecord.type === 'uri') {
    return Response.redirect(rootRecord.content, 302);
  }

  // Check for curl user agent
  const userAgent = request.headers.get('User-Agent') || '';

  if (userAgent.includes('curl/')) {
    return new Response(
      `raj.quest
===

Personal URL shortener and notes.

Examples:
  raj.quest/github  -> GitHub profile
  raj.quest/linkedin -> LinkedIn profile
`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  }

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>raj.quest</title>
  <link rel="icon" href="/favicon.ico">
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
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      color: #fff;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    p {
      color: #666;
      font-size: 1.125rem;
    }
    .links {
      margin-top: 2rem;
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
      font-size: 1rem;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>raj.quest</h1>
    <p>Personal URL shortener &amp; notes</p>
    <div class="links">
      <a href="/github">GitHub</a>
      <a href="/linkedin">LinkedIn</a>
    </div>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
