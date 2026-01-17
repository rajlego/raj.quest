/**
 * Admin interface handlers
 * Protected by Cloudflare Access (authentication happens before reaching worker)
 */

import {
  isAuthenticated,
  getAccessUserEmail,
  hashPassword,
} from './auth';
import {
  listAllRecords,
  saveRecord,
  deleteRecord,
  parseBulkFormat,
  serializeBulkFormat,
  isValidKey,
  isValidUrl,
  type Env,
} from './storage';

/**
 * Admin dashboard HTML (bulk editor)
 */
function getAdminDashboardHTML(
  content: string,
  userEmail: string,
  message?: string,
  isError?: boolean
): string {
  const messageHtml = message
    ? `<div class="message ${isError ? 'error' : ''}">${escapeHtml(message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - raj.quest</title>
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
      padding: 1rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    h1 {
      font-size: 1.25rem;
      color: #fff;
    }
    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .user-email {
      color: #666;
      font-size: 0.875rem;
    }
    .header-actions a {
      color: #888;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .header-actions a:hover {
      color: #fff;
    }
    .message {
      background: #1e3a1e;
      border: 1px solid #2d5a2d;
      color: #4ade80;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    .message.error {
      background: #3d1f1f;
      border: 1px solid #6b2c2c;
      color: #f87171;
    }
    .editor-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 140px);
    }
    .help-text {
      font-size: 0.75rem;
      color: #666;
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    .help-text code {
      background: #1a1a1a;
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
    }
    textarea {
      flex: 1;
      width: 100%;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.875rem;
      background: #111;
      color: #e0e0e0;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 1rem;
      resize: none;
      line-height: 1.5;
    }
    textarea:focus {
      outline: none;
      border-color: #555;
    }
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
      justify-content: space-between;
      align-items: center;
    }
    .actions-left {
      display: flex;
      gap: 1rem;
    }
    button {
      padding: 0.5rem 1rem;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #2563eb;
    }
    button.secondary {
      background: #333;
    }
    button.secondary:hover {
      background: #444;
    }
    .status {
      font-size: 0.75rem;
      color: #666;
    }
    .kbd {
      display: inline-block;
      padding: 0.125rem 0.375rem;
      font-size: 0.75rem;
      background: #222;
      border: 1px solid #444;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>raj.quest Admin</h1>
    <div class="header-actions">
      <span class="user-email">${escapeHtml(userEmail)}</span>
      <a href="/">View Site</a>
    </div>
  </div>
  ${messageHtml}
  <form method="POST" action="/admin/save" id="editor-form">
    <div class="editor-container">
      <div class="help-text">
        <strong>Format:</strong>
        <code>key -&gt; url</code> redirect |
        <code>key [password] -&gt; url</code> password-protected |
        <code>key ---</code> ... <code>---</code> markdown note |
        Lines starting with <code>#</code> are comments
      </div>
      <textarea name="content" id="editor" spellcheck="false">${escapeHtml(content)}</textarea>
      <div class="actions">
        <div class="actions-left">
          <button type="submit">Save</button>
          <button type="button" class="secondary" onclick="location.reload()">Reset</button>
        </div>
        <span class="status">Save: <span class="kbd">Cmd+S</span></span>
      </div>
    </div>
  </form>
  <script>
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('editor-form').submit();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Unauthorized page (Cloudflare Access should prevent this, but just in case)
 */
function getUnauthorizedHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unauthorized - raj.quest</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      color: #f87171;
      margin-bottom: 1rem;
    }
    p {
      color: #888;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unauthorized</h1>
    <p>You don't have permission to access this page.</p>
    <p><a href="/">Go to raj.quest</a></p>
  </div>
</body>
</html>`;
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
 * Handle admin routes
 */
export async function handleAdmin(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Check authentication via Cloudflare Access
  // Note: Cloudflare Access should block unauthenticated requests before they reach here,
  // but we check anyway for defense in depth
  if (!isAuthenticated(request, env)) {
    return new Response(getUnauthorizedHTML(), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const userEmail = getAccessUserEmail(request) || 'unknown';

  // Save content
  if (path === '/admin/save' && request.method === 'POST') {
    return handleSave(request, env, userEmail);
  }

  // Dashboard (default admin page)
  const records = await listAllRecords(env.REDIRECTS);
  const content = serializeBulkFormat(records);
  return new Response(getAdminDashboardHTML(content, userEmail), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Handle save
 */
async function handleSave(
  request: Request,
  env: Env,
  userEmail: string
): Promise<Response> {
  const formData = await request.formData();
  const content = formData.get('content') as string;

  if (!content) {
    const records = await listAllRecords(env.REDIRECTS);
    const currentContent = serializeBulkFormat(records);
    return new Response(
      getAdminDashboardHTML(currentContent, userEmail, 'No content provided.', true),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Parse the bulk format
  const { entries, errors } = parseBulkFormat(content);

  if (errors.length > 0) {
    return new Response(
      getAdminDashboardHTML(content, userEmail, `Parse errors: ${errors.join(', ')}`, true),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Validate entries
  const validationErrors: string[] = [];
  for (const entry of entries) {
    if (!isValidKey(entry.key)) {
      validationErrors.push(`Invalid key: "${entry.key}"`);
    }
    if (entry.record.type === 'uri' && !isValidUrl(entry.record.content)) {
      validationErrors.push(`Invalid URL for "${entry.key}": "${entry.record.content}"`);
    }
  }

  if (validationErrors.length > 0) {
    return new Response(
      getAdminDashboardHTML(content, userEmail, `Validation errors: ${validationErrors.join(', ')}`, true),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Get existing records to preserve password hashes
  const existingRecords = await listAllRecords(env.REDIRECTS);

  // Build set of new keys
  const newKeys = new Set(entries.map(e => e.key));

  // Delete records that are no longer in the list
  for (const existingKey of existingRecords.keys()) {
    if (!newKeys.has(existingKey)) {
      await deleteRecord(env.REDIRECTS, existingKey);
    }
  }

  // Save new/updated records
  for (const entry of entries) {
    const existingRecord = existingRecords.get(entry.key);

    // If entry has a raw password, hash it
    if (entry.rawPassword) {
      entry.record.passwordHash = await hashPassword(entry.rawPassword);
    } else if (existingRecord?.passwordHash) {
      // Preserve existing password hash if using placeholder
      entry.record.passwordHash = existingRecord.passwordHash;
    }

    // Preserve timestamps if updating
    if (existingRecord) {
      entry.record.createdAt = existingRecord.createdAt;
    }

    await saveRecord(env.REDIRECTS, entry.key, entry.record);
  }

  // Reload records and show success
  const updatedRecords = await listAllRecords(env.REDIRECTS);
  const updatedContent = serializeBulkFormat(updatedRecords);

  return new Response(
    getAdminDashboardHTML(updatedContent, userEmail, `Saved ${entries.length} records.`),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
