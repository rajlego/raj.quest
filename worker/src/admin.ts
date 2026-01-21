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
  <title>admin - raj.quest</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #111;
      --bg-tertiary: #1a1a1a;
      --text-primary: #e0e0e0;
      --text-secondary: #888;
      --text-muted: #666;
      --border-color: #333;
      --border-hover: #555;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success-bg: #1e3a1e;
      --success-border: #2d5a2d;
      --success-text: #4ade80;
      --error-bg: #3d1f1f;
      --error-border: #6b2c2c;
      --error-text: #f87171;
    }
    body.light {
      --bg-primary: #f5f5f5;
      --bg-secondary: #fff;
      --bg-tertiary: #e5e5e5;
      --text-primary: #1a1a1a;
      --text-secondary: #555;
      --text-muted: #888;
      --border-color: #ddd;
      --border-hover: #bbb;
      --accent: #2563eb;
      --accent-hover: #1d4ed8;
      --success-bg: #dcfce7;
      --success-border: #86efac;
      --success-text: #166534;
      --error-bg: #fee2e2;
      --error-border: #fca5a5;
      --error-text: #991b1b;
    }
    body.space {
      --bg-primary: #0a0a1a;
      --bg-secondary: rgba(15, 15, 35, 0.95);
      --bg-tertiary: rgba(25, 25, 55, 0.95);
      --text-primary: #e0e0ff;
      --text-secondary: #a0a0d0;
      --text-muted: #7070a0;
      --border-color: rgba(100, 100, 200, 0.3);
      --border-hover: rgba(150, 150, 255, 0.5);
      --accent: #8b5cf6;
      --accent-hover: #7c3aed;
    }
    body.space::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.6), transparent),
        radial-gradient(2px 2px at 40% 15%, rgba(255,255,255,0.9), transparent),
        radial-gradient(1px 1px at 55% 45%, rgba(255,255,255,0.5), transparent),
        radial-gradient(2px 2px at 70% 25%, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 85% 55%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 15% 70%, rgba(255,255,255,0.5), transparent),
        radial-gradient(2px 2px at 30% 85%, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 50% 75%, rgba(255,255,255,0.4), transparent),
        radial-gradient(1px 1px at 65% 90%, rgba(255,255,255,0.6), transparent),
        radial-gradient(2px 2px at 80% 70%, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 95% 40%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 5% 50%, rgba(255,255,255,0.4), transparent),
        radial-gradient(1px 1px at 20% 5%, rgba(255,255,255,0.6), transparent),
        radial-gradient(2px 2px at 45% 60%, rgba(200,180,255,0.5), transparent),
        radial-gradient(1px 1px at 75% 10%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 90% 80%, rgba(180,200,255,0.4), transparent),
        linear-gradient(to bottom, #0a0a1a 0%, #151530 50%, #0a0a1a 100%);
      z-index: -1;
      animation: twinkle 8s ease-in-out infinite;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 1rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }
    h1 {
      font-size: 1.25rem;
      color: var(--text-primary);
      font-weight: 500;
    }
    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .user-email {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .header-actions a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .header-actions a:hover {
      color: var(--text-primary);
    }
    .header-actions a.logout {
      color: var(--error-text);
    }
    .theme-toggle {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 50%;
      width: 32px;
      height: 32px;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      color: var(--text-primary);
    }
    .theme-toggle:hover {
      border-color: var(--border-hover);
      background: var(--bg-secondary);
    }
    .message {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--success-text);
      padding: 0.75rem 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }
    .message.error {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: var(--error-text);
    }
    .editor-wrapper {
      max-width: 1200px;
      margin: 0 auto;
    }
    .editor-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 160px);
    }
    .help-text {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    .help-text code {
      background: var(--bg-tertiary);
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
    }
    textarea {
      flex: 1;
      width: 100%;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.875rem;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 1rem;
      resize: none;
      line-height: 1.5;
    }
    textarea:focus {
      outline: none;
      border-color: var(--border-hover);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    .actions-left {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    button {
      padding: 0.5rem 1rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: var(--accent-hover);
    }
    button.secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }
    button.secondary:hover {
      background: var(--bg-secondary);
      border-color: var(--border-hover);
    }
    .status {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .backup-status {
      color: var(--text-muted);
    }
    .backup-status.saved {
      color: var(--success-text);
    }
    .kbd {
      display: inline-block;
      padding: 0.125rem 0.375rem;
      font-size: 0.75rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      font-family: monospace;
    }
    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal.open {
      display: flex;
    }
    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }
    .modal-header h3 {
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary);
    }
    .close-btn {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .close-btn:hover {
      color: var(--text-primary);
      background: transparent;
    }
    .modal-body {
      flex: 1;
      overflow: auto;
      padding: 1rem;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }
    .form-row {
      margin-bottom: 1rem;
    }
    .form-row label {
      display: block;
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 0.25rem;
    }
    .form-row input {
      width: 100%;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
      font-size: 0.875rem;
    }
    .form-row input:focus {
      outline: none;
      border-color: var(--border-hover);
    }
    .note-editor-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      height: 350px;
    }
    @media (max-width: 700px) {
      .note-editor-grid {
        grid-template-columns: 1fr;
        height: auto;
      }
      .note-editor-grid > div {
        height: 200px;
      }
    }
    .note-editor-grid > div {
      display: flex;
      flex-direction: column;
    }
    .note-editor-grid label {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }
    .note-editor-grid textarea {
      flex: 1;
      min-height: 0;
    }
    .note-preview {
      flex: 1;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 1rem;
      overflow: auto;
      font-size: 0.875rem;
      line-height: 1.6;
    }
    .note-preview h1, .note-preview h2, .note-preview h3 {
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    .note-preview h1:first-child, .note-preview h2:first-child, .note-preview h3:first-child {
      margin-top: 0;
    }
    .note-preview p {
      margin-bottom: 0.75em;
    }
    .note-preview code {
      background: var(--bg-secondary);
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
      font-size: 0.85em;
    }
    .note-preview pre {
      background: var(--bg-secondary);
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
      margin-bottom: 0.75em;
    }
    .note-preview pre code {
      background: none;
      padding: 0;
    }
    .note-preview a {
      color: var(--accent);
    }
    .note-preview ul, .note-preview ol {
      margin-bottom: 0.75em;
      padding-left: 1.5em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>raj.quest admin</h1>
    <div class="header-actions">
      <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
        <span id="theme-icon">&#9790;</span>
      </button>
      <span class="user-email">${escapeHtml(userEmail)}</span>
      <a href="/">View Site</a>
      <a href="/cdn-cgi/access/logout" class="logout">Logout</a>
    </div>
  </div>
  ${messageHtml}
  <div class="editor-wrapper">
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
            <button type="button" class="secondary" onclick="exportData()">Export JSON</button>
            <button type="button" class="secondary" onclick="openNoteModal()">+ Add Note</button>
          </div>
          <span class="status">
            <span class="backup-status" id="backup-status"></span>
            Save: <span class="kbd">Cmd+S</span>
          </span>
        </div>
      </div>
    </form>
  </div>

  <!-- Note Editor Modal -->
  <div class="modal" id="note-modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="note-modal-title">Add Note</h3>
        <button class="close-btn" onclick="closeNoteModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label for="note-key">Key (URL path):</label>
          <input type="text" id="note-key" placeholder="my-note" pattern="[a-zA-Z0-9_-]+" />
        </div>
        <div class="form-row">
          <label for="note-password">Password (optional):</label>
          <input type="text" id="note-password" placeholder="Leave empty for public access" />
        </div>
        <div class="note-editor-grid">
          <div>
            <label>Markdown Content:</label>
            <textarea id="note-content" placeholder="# My Note

Write your content here using Markdown..." oninput="updateNotePreview()"></textarea>
          </div>
          <div>
            <label>Preview:</label>
            <div class="note-preview" id="note-preview"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="secondary" onclick="closeNoteModal()">Cancel</button>
        <button onclick="insertNote()">Insert Note</button>
      </div>
    </div>
  </div>

  <script>
    // ==================== Theme Management ====================
    const themes = ['dark', 'light', 'space'];
    const themeIcons = { dark: '\\u263E', light: '\\u2600', space: '\\u2B50' };
    let currentTheme = localStorage.getItem('raj-admin-theme') || 'dark';

    function initTheme() {
      const hour = new Date().getHours();
      const isNight = hour >= 20 || hour < 6;
      if (isNight && currentTheme === 'dark' && localStorage.getItem('raj-admin-theme') === null) {
        currentTheme = 'space';
      }
      applyTheme(currentTheme);
    }

    function applyTheme(theme) {
      document.body.classList.remove('light', 'space');
      if (theme !== 'dark') {
        document.body.classList.add(theme);
      }
      currentTheme = theme;
      localStorage.setItem('raj-admin-theme', theme);
      document.getElementById('theme-icon').innerHTML = themeIcons[theme];
    }

    function toggleTheme() {
      const idx = themes.indexOf(currentTheme);
      const nextTheme = themes[(idx + 1) % themes.length];
      applyTheme(nextTheme);
    }

    initTheme();

    // ==================== Auto-Backup ====================
    const BACKUP_KEY = 'raj-admin-backup';
    const BACKUP_TIME_KEY = 'raj-admin-backup-time';
    let backupTimeout = null;
    const originalContent = document.getElementById('editor').value;

    function initBackup() {
      const backup = localStorage.getItem(BACKUP_KEY);
      const backupTime = localStorage.getItem(BACKUP_TIME_KEY);

      if (backup && backup !== originalContent && backupTime) {
        const when = new Date(parseInt(backupTime)).toLocaleString();
        if (confirm('Found unsaved backup from ' + when + '. Restore it?')) {
          document.getElementById('editor').value = backup;
          updateBackupStatus('Restored');
        } else {
          clearBackup();
        }
      }

      document.getElementById('editor').addEventListener('input', debounceBackup);
    }

    function debounceBackup() {
      clearTimeout(backupTimeout);
      updateBackupStatus('...');
      backupTimeout = setTimeout(saveBackup, 1000);
    }

    function saveBackup() {
      const content = document.getElementById('editor').value;
      localStorage.setItem(BACKUP_KEY, content);
      localStorage.setItem(BACKUP_TIME_KEY, Date.now().toString());
      updateBackupStatus('Backup saved');
    }

    function clearBackup() {
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(BACKUP_TIME_KEY);
    }

    function updateBackupStatus(msg) {
      const el = document.getElementById('backup-status');
      el.textContent = msg;
      el.className = 'backup-status' + (msg.includes('saved') || msg.includes('Restored') ? ' saved' : '');
    }

    document.getElementById('editor-form').addEventListener('submit', clearBackup);
    initBackup();

    // ==================== Export ====================
    function exportData() {
      const content = document.getElementById('editor').value;
      const lines = content.split('\\n');
      const records = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) { i++; continue; }

        const noteMatch = line.match(/^([a-zA-Z0-9_-]+)\\s*(?:\\[([^\\]]+)\\])?\\s*---$/);
        if (noteMatch) {
          const [, key, pw] = noteMatch;
          const contentLines = [];
          i++;
          while (i < lines.length && lines[i].trim() !== '---') {
            contentLines.push(lines[i]);
            i++;
          }
          i++;
          records.push({ key, type: 'note', content: contentLines.join('\\n'), hasPassword: !!pw && pw !== '********' });
          continue;
        }

        const redirMatch = line.match(/^([a-zA-Z0-9_-]+)\\s*(?:\\[([^\\]]+)\\])?\\s*->\\s*(.+)$/);
        if (redirMatch) {
          const [, key, pw, url] = redirMatch;
          records.push({ key, type: 'redirect', url: url.trim(), hasPassword: !!pw && pw !== '********' });
        }
        i++;
      }

      const data = { exportedAt: new Date().toISOString(), source: 'raj.quest', recordCount: records.length, records };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'raj-quest-export-' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    // ==================== Note Modal ====================
    function openNoteModal() {
      document.getElementById('note-key').value = '';
      document.getElementById('note-password').value = '';
      document.getElementById('note-content').value = '';
      document.getElementById('note-preview').innerHTML = '';
      document.getElementById('note-modal-title').textContent = 'Add Note';
      document.getElementById('note-modal').classList.add('open');
      document.getElementById('note-key').focus();
    }

    function closeNoteModal() {
      document.getElementById('note-modal').classList.remove('open');
    }

    function updateNotePreview() {
      const content = document.getElementById('note-content').value;
      const preview = document.getElementById('note-preview');
      if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(content);
      } else {
        preview.textContent = content;
      }
    }

    function insertNote() {
      const key = document.getElementById('note-key').value.trim();
      const password = document.getElementById('note-password').value.trim();
      const content = document.getElementById('note-content').value;

      if (!key || !/^[a-zA-Z0-9_-]+$/.test(key)) {
        alert('Key must only contain letters, numbers, hyphens, and underscores');
        document.getElementById('note-key').focus();
        return;
      }

      if (!content.trim()) {
        alert('Note content cannot be empty');
        document.getElementById('note-content').focus();
        return;
      }

      const editor = document.getElementById('editor');
      const pwPart = password ? ' [' + password + ']' : '';
      const noteBlock = '\\n' + key + pwPart + ' ---\\n' + content + '\\n---\\n';

      editor.value = editor.value.trimEnd() + noteBlock;
      debounceBackup();
      closeNoteModal();
    }

    // ==================== Keyboard Shortcuts ====================
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('editor-form').submit();
      }
      if (e.key === 'Escape') {
        closeNoteModal();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !document.getElementById('note-modal').classList.contains('open')) {
        e.preventDefault();
        openNoteModal();
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
