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
  getRecord,
  parseBulkFormat,
  serializeBulkFormat,
  isValidKey,
  isValidUrl,
  updateLineTimestamps,
  formatRelativeTime,
  type Env,
  type StoredRecord,
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
      --bg-primary: #f7f4e9;
      --bg-secondary: #fffef8;
      --bg-tertiary: #ebe7d9;
      --text-primary: #2d3a2d;
      --text-secondary: #4a5d4a;
      --text-muted: #6b7c6b;
      --border-color: #c5d4b5;
      --border-hover: #8fa97f;
      --accent: #5a8f4a;
      --accent-hover: #4a7a3a;
      --success-bg: #e8f5e0;
      --success-border: #a8d08d;
      --success-text: #2d5a1d;
      --error-bg: #fce8e0;
      --error-border: #e8a090;
      --error-text: #8b3a2a;
    }
    body.light::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        linear-gradient(135deg, #f7f4e9 0%, #eef5e6 50%, #f7f4e9 100%);
      z-index: -2;
    }
    body.light::after {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 9999;
      background-image:
        /* Top left vine */
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Cpath d='M0,0 Q30,50 20,100 T40,200 T20,300' stroke='%234a7a3a' stroke-width='3' fill='none' opacity='0.3'/%3E%3Cpath d='M20,100 Q40,90 50,100' stroke='%234a7a3a' stroke-width='2' fill='none' opacity='0.3'/%3E%3Cpath d='M40,200 Q60,190 70,200' stroke='%234a7a3a' stroke-width='2' fill='none' opacity='0.3'/%3E%3Cellipse cx='55' cy='95' rx='12' ry='8' fill='%235a8f4a' opacity='0.25' transform='rotate(-20 55 95)'/%3E%3Cellipse cx='75' cy='195' rx='12' ry='8' fill='%235a8f4a' opacity='0.25' transform='rotate(-15 75 195)'/%3E%3Cellipse cx='25' cy='150' rx='10' ry='7' fill='%236ba05a' opacity='0.2' transform='rotate(15 25 150)'/%3E%3C/svg%3E"),
        /* Top right vine */
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Cpath d='M200,0 Q170,60 180,120 T160,220 T180,300' stroke='%234a7a3a' stroke-width='3' fill='none' opacity='0.3'/%3E%3Cpath d='M180,120 Q160,110 150,120' stroke='%234a7a3a' stroke-width='2' fill='none' opacity='0.3'/%3E%3Cpath d='M160,220 Q140,210 130,225' stroke='%234a7a3a' stroke-width='2' fill='none' opacity='0.3'/%3E%3Cellipse cx='145' cy='115' rx='12' ry='8' fill='%235a8f4a' opacity='0.25' transform='rotate(20 145 115)'/%3E%3Cellipse cx='125' cy='220' rx='12' ry='8' fill='%235a8f4a' opacity='0.25' transform='rotate(15 125 220)'/%3E%3Cellipse cx='175' cy='170' rx='10' ry='7' fill='%236ba05a' opacity='0.2' transform='rotate(-15 175 170)'/%3E%3C/svg%3E"),
        /* Bottom corner leaves */
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cellipse cx='20' cy='80' rx='18' ry='10' fill='%235a8f4a' opacity='0.2' transform='rotate(-30 20 80)'/%3E%3Cellipse cx='50' cy='90' rx='15' ry='8' fill='%234a7a3a' opacity='0.15' transform='rotate(-10 50 90)'/%3E%3Cellipse cx='80' cy='85' rx='16' ry='9' fill='%236ba05a' opacity='0.18' transform='rotate(20 80 85)'/%3E%3C/svg%3E");
      background-position: top left, top right, bottom center;
      background-repeat: no-repeat;
      background-size: 150px 300px, 150px 300px, 300px 100px;
      opacity: 0.8;
    }
    /* Leaf decorations for light theme */
    body.light .header::before {
      content: '\\1F33F';
      position: absolute;
      left: -30px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.5rem;
      opacity: 0.4;
    }
    body.light .header {
      position: relative;
    }
    body.space {
      --bg-primary: #050510;
      --bg-secondary: rgba(10, 10, 30, 0.95);
      --bg-tertiary: rgba(20, 20, 50, 0.95);
      --text-primary: #e8e8ff;
      --text-secondary: #b0b0e0;
      --text-muted: #8080b0;
      --border-color: rgba(120, 100, 220, 0.3);
      --border-hover: rgba(160, 140, 255, 0.5);
      --accent: #a78bfa;
      --accent-hover: #8b5cf6;
    }
    body.space::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #050510;
      z-index: -2;
    }
    body.space::after {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        /* Nebula glow */
        radial-gradient(ellipse 80% 50% at 20% 60%, rgba(100, 50, 180, 0.15), transparent),
        radial-gradient(ellipse 60% 40% at 80% 30%, rgba(50, 100, 180, 0.12), transparent),
        radial-gradient(ellipse 50% 60% at 50% 80%, rgba(150, 50, 100, 0.08), transparent),
        /* Bright stars */
        radial-gradient(2px 2px at 10% 15%, #fff, transparent),
        radial-gradient(2px 2px at 30% 25%, #fff, transparent),
        radial-gradient(3px 3px at 50% 10%, rgba(200, 220, 255, 1), transparent),
        radial-gradient(2px 2px at 70% 35%, #fff, transparent),
        radial-gradient(2px 2px at 90% 20%, #fff, transparent),
        radial-gradient(3px 3px at 15% 55%, rgba(255, 240, 200, 1), transparent),
        radial-gradient(2px 2px at 35% 70%, #fff, transparent),
        radial-gradient(2px 2px at 55% 45%, #fff, transparent),
        radial-gradient(3px 3px at 75% 65%, rgba(200, 200, 255, 1), transparent),
        radial-gradient(2px 2px at 95% 55%, #fff, transparent),
        /* Medium stars */
        radial-gradient(1.5px 1.5px at 5% 35%, rgba(255,255,255,0.9), transparent),
        radial-gradient(1.5px 1.5px at 25% 5%, rgba(255,255,255,0.8), transparent),
        radial-gradient(1.5px 1.5px at 45% 85%, rgba(255,255,255,0.9), transparent),
        radial-gradient(1.5px 1.5px at 65% 15%, rgba(255,255,255,0.85), transparent),
        radial-gradient(1.5px 1.5px at 85% 75%, rgba(255,255,255,0.9), transparent),
        radial-gradient(1.5px 1.5px at 12% 82%, rgba(255,255,255,0.8), transparent),
        radial-gradient(1.5px 1.5px at 38% 42%, rgba(255,255,255,0.85), transparent),
        radial-gradient(1.5px 1.5px at 62% 92%, rgba(255,255,255,0.9), transparent),
        radial-gradient(1.5px 1.5px at 82% 8%, rgba(255,255,255,0.8), transparent),
        /* Small dim stars */
        radial-gradient(1px 1px at 8% 48%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 28% 58%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 42% 18%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 52% 68%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 68% 48%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 78% 88%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 88% 38%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 3% 73%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 23% 93%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 47% 33%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 73% 3%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 93% 63%, rgba(255,255,255,0.5), transparent);
      z-index: -1;
      animation: twinkle 4s ease-in-out infinite;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.92; }
    }
    /* Shooting star */
    body.space .shooting-star {
      position: fixed;
      width: 100px;
      height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.8), transparent);
      transform: rotate(-45deg);
      animation: shoot 3s ease-out infinite;
      opacity: 0;
      z-index: -1;
    }
    @keyframes shoot {
      0% { transform: translateX(-100px) translateY(-100px) rotate(-45deg); opacity: 0; }
      5% { opacity: 1; }
      20% { transform: translateX(400px) translateY(400px) rotate(-45deg); opacity: 0; }
      100% { opacity: 0; }
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
    /* Backup Comparison Modal */
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    @media (max-width: 700px) {
      .comparison-grid {
        grid-template-columns: 1fr;
      }
    }
    .comparison-panel {
      display: flex;
      flex-direction: column;
    }
    .comparison-panel h4 {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .comparison-panel .stats {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: normal;
    }
    .comparison-panel pre {
      flex: 1;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 0.75rem;
      font-size: 0.75rem;
      overflow: auto;
      max-height: 300px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .comparison-summary {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .comparison-summary h4 {
      font-size: 0.875rem;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }
    .comparison-summary .diff-stats {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .diff-stat {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    .diff-stat .label {
      color: var(--text-muted);
    }
    .diff-stat .value {
      font-weight: 600;
    }
    .diff-stat .value.added {
      color: var(--success-text);
    }
    .diff-stat .value.removed {
      color: var(--error-text);
    }
    .diff-stat .value.neutral {
      color: var(--text-primary);
    }
    .tabs {
      display: flex;
      gap: 0;
      max-width: 1200px;
      margin: 0 auto 1rem;
    }
    .tab {
      padding: 0.75rem 1.5rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-bottom: none;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .tab:first-child { border-radius: 4px 0 0 0; }
    .tab:last-child { border-radius: 0 4px 0 0; }
    .tab.active {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-bottom: 1px solid var(--bg-secondary);
      margin-bottom: -1px;
    }
    .tab:hover:not(.active) { background: var(--bg-secondary); }
    /* Quick Add Bar */
    .quick-add {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 1rem;
    }
    .quick-add input {
      flex: 1;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.875rem;
    }
    .quick-add input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    .quick-add input::placeholder {
      color: var(--text-muted);
    }
    .quick-add-status {
      font-size: 0.75rem;
      min-width: 120px;
      text-align: right;
    }
    .quick-add-status.success {
      color: var(--success-text);
    }
    .quick-add-status.error {
      color: var(--error-text);
    }
    .quick-add-status.loading {
      color: var(--text-muted);
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

  <div class="tabs">
    <a href="/admin" class="tab active">Redirects</a>
    <a href="/admin/notes" class="tab">Notes</a>
  </div>

  ${messageHtml}
  <div class="editor-wrapper">
    <!-- Quick Add Bar -->
    <div class="quick-add">
      <input type="text" id="quick-add-input" placeholder="key -> url (press Enter to add, Cmd+K to focus)" autocomplete="off" />
      <span class="quick-add-status" id="quick-add-status"></span>
    </div>
  </div>

  <div class="editor-wrapper">
    <form method="POST" action="/admin/save" id="editor-form">
      <div class="editor-container">
        <div class="help-text">
          <strong>Format:</strong>
          <code>key -&gt; url</code> redirect |
          <code>key [password] -&gt; url</code> password-protected |
          Lines starting with <code>#</code> are comments
        </div>
        <textarea name="content" id="editor" spellcheck="false">${escapeHtml(content)}</textarea>
        <div class="actions">
          <div class="actions-left">
            <button type="submit">Save</button>
            <button type="button" class="secondary" onclick="exportData()">Export JSON</button>
          </div>
          <span class="status">
            <span class="backup-status" id="backup-status"></span>
            <span class="kbd">Cmd+K</span> Quick add
            <span class="kbd">Cmd+S</span> Save
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

  <!-- Backup Comparison Modal -->
  <div class="modal" id="backup-modal">
    <div class="modal-content" style="max-width: 1000px;">
      <div class="modal-header">
        <h3>Restore Backup?</h3>
        <button class="close-btn" onclick="closeBackupModal(false)">&times;</button>
      </div>
      <div class="modal-body">
        <div class="comparison-summary">
          <h4>Comparison</h4>
          <div class="diff-stats">
            <div class="diff-stat">
              <span class="label">Backup from:</span>
              <span class="value neutral" id="backup-time">-</span>
            </div>
            <div class="diff-stat">
              <span class="label">Lines added:</span>
              <span class="value added" id="lines-added">0</span>
            </div>
            <div class="diff-stat">
              <span class="label">Lines removed:</span>
              <span class="value removed" id="lines-removed">0</span>
            </div>
            <div class="diff-stat">
              <span class="label">Backup size:</span>
              <span class="value neutral" id="backup-size">-</span>
            </div>
            <div class="diff-stat">
              <span class="label">Server size:</span>
              <span class="value neutral" id="server-size">-</span>
            </div>
          </div>
        </div>
        <div class="comparison-grid">
          <div class="comparison-panel">
            <h4>
              Local Backup (cached)
              <span class="stats" id="backup-lines">0 lines</span>
            </h4>
            <pre id="backup-preview"></pre>
          </div>
          <div class="comparison-panel">
            <h4>
              Server Version (saved)
              <span class="stats" id="server-lines">0 lines</span>
            </h4>
            <pre id="server-preview"></pre>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="secondary" onclick="closeBackupModal(false)">Keep Server Version</button>
        <button onclick="closeBackupModal(true)">Restore Backup</button>
      </div>
    </div>
  </div>

  <script>
    // ==================== Theme Management ====================
    const themes = ['space', 'dark', 'light'];
    const themeIcons = { dark: '\\u263E', light: '\\u2600', space: '\\u2B50' };
    let currentTheme = localStorage.getItem('raj-admin-theme') || 'space';

    function initTheme() {
      applyTheme(currentTheme);
      // Add shooting stars for space theme
      if (currentTheme === 'space') {
        addShootingStars();
      }
    }

    function applyTheme(theme) {
      document.body.classList.remove('light', 'space');
      if (theme !== 'dark') {
        document.body.classList.add(theme);
      }
      currentTheme = theme;
      localStorage.setItem('raj-admin-theme', theme);
      document.getElementById('theme-icon').innerHTML = themeIcons[theme];

      // Handle shooting stars
      const existingStars = document.querySelectorAll('.shooting-star');
      existingStars.forEach(s => s.remove());
      if (theme === 'space') {
        addShootingStars();
      }
    }

    function addShootingStars() {
      for (let i = 0; i < 3; i++) {
        const star = document.createElement('div');
        star.className = 'shooting-star';
        star.style.top = (Math.random() * 50) + '%';
        star.style.left = (Math.random() * 50) + '%';
        star.style.animationDelay = (i * 4 + Math.random() * 2) + 's';
        star.style.animationDuration = (2 + Math.random() * 2) + 's';
        document.body.appendChild(star);
      }
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
    let pendingBackup = null;

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function countLines(text) {
      return text.split('\\n').length;
    }

    function computeDiff(backup, server) {
      const backupLines = new Set(backup.split('\\n'));
      const serverLines = new Set(server.split('\\n'));
      let added = 0, removed = 0;
      backupLines.forEach(line => { if (!serverLines.has(line)) added++; });
      serverLines.forEach(line => { if (!backupLines.has(line)) removed++; });
      return { added, removed };
    }

    function showBackupModal(backup, server, backupTime) {
      pendingBackup = backup;
      const diff = computeDiff(backup, server);

      document.getElementById('backup-time').textContent = new Date(parseInt(backupTime)).toLocaleString();
      document.getElementById('lines-added').textContent = '+' + diff.added;
      document.getElementById('lines-removed').textContent = '-' + diff.removed;
      document.getElementById('backup-size').textContent = formatBytes(backup.length);
      document.getElementById('server-size').textContent = formatBytes(server.length);
      document.getElementById('backup-lines').textContent = countLines(backup) + ' lines';
      document.getElementById('server-lines').textContent = countLines(server) + ' lines';

      // Show preview (first 50 lines)
      const previewLines = 50;
      document.getElementById('backup-preview').textContent = backup.split('\\n').slice(0, previewLines).join('\\n') +
        (countLines(backup) > previewLines ? '\\n... (' + (countLines(backup) - previewLines) + ' more lines)' : '');
      document.getElementById('server-preview').textContent = server.split('\\n').slice(0, previewLines).join('\\n') +
        (countLines(server) > previewLines ? '\\n... (' + (countLines(server) - previewLines) + ' more lines)' : '');

      document.getElementById('backup-modal').classList.add('open');
    }

    function closeBackupModal(restore) {
      document.getElementById('backup-modal').classList.remove('open');
      if (restore && pendingBackup) {
        document.getElementById('editor').value = pendingBackup;
        updateBackupStatus('Restored');
      } else {
        clearBackup();
      }
      pendingBackup = null;
    }

    // Normalize content for comparison (parse records, sort, compare)
    function normalizeForComparison(text) {
      const lines = text.split('\\n');
      const records = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) { i++; continue; }

        // Note block
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
          records.push({ key, type: 'note', content: contentLines.join('\\n'), pw: pw || '' });
          continue;
        }

        // Redirect
        const redirMatch = line.match(/^([a-zA-Z0-9_-]+)\\s*(?:\\[([^\\]]+)\\])?\\s*->\\s*(.+)$/);
        if (redirMatch) {
          const [, key, pw, url] = redirMatch;
          records.push({ key, type: 'redirect', url: url.trim(), pw: pw || '' });
        }
        i++;
      }

      // Sort by key and return a normalized string representation
      records.sort((a, b) => a.key.localeCompare(b.key));
      return JSON.stringify(records);
    }

    function initBackup() {
      const backup = localStorage.getItem(BACKUP_KEY);
      const backupTime = localStorage.getItem(BACKUP_TIME_KEY);

      // Compare normalized versions to avoid false positives from sort order differences
      if (backup && backupTime) {
        const normalizedBackup = normalizeForComparison(backup);
        const normalizedServer = normalizeForComparison(originalContent);
        if (normalizedBackup !== normalizedServer) {
          showBackupModal(backup, originalContent, backupTime);
        } else {
          // Same content, just different order - clear the backup
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

    // ==================== Quick Add ====================
    const quickAddInput = document.getElementById('quick-add-input');
    const quickAddStatus = document.getElementById('quick-add-status');

    function setQuickAddStatus(msg, type) {
      quickAddStatus.textContent = msg;
      quickAddStatus.className = 'quick-add-status ' + (type || '');
      if (type === 'success') {
        setTimeout(() => { quickAddStatus.textContent = ''; quickAddStatus.className = 'quick-add-status'; }, 3000);
      }
    }

    function parseQuickAdd(input) {
      const match = input.trim().match(/^([a-zA-Z0-9_-]+)\\s*->\\s*(.+)$/);
      if (!match) return null;
      return { key: match[1], url: match[2].trim() };
    }

    async function handleQuickAdd() {
      const input = quickAddInput.value.trim();
      if (!input) return;

      const parsed = parseQuickAdd(input);
      if (!parsed) {
        setQuickAddStatus('Format: key -> url', 'error');
        return;
      }

      setQuickAddStatus('Adding...', 'loading');

      try {
        const resp = await fetch('/admin/quick-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        const data = await resp.json();

        if (data.success) {
          setQuickAddStatus('Added: ' + parsed.key, 'success');
          quickAddInput.value = '';
          // Add to editor
          const editor = document.getElementById('editor');
          const newLine = parsed.key + ' -> ' + parsed.url;
          if (editor.value && !editor.value.endsWith('\\n')) {
            editor.value += '\\n';
          }
          editor.value += newLine + '\\n';
          debounceBackup();
        } else {
          setQuickAddStatus(data.error || 'Error', 'error');
        }
      } catch (err) {
        setQuickAddStatus('Network error', 'error');
      }
    }

    quickAddInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickAdd();
      }
    });

    // ==================== Keyboard Shortcuts ====================
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('editor-form').submit();
      }
      if (e.key === 'Escape') {
        closeNoteModal();
        closeBackupModal(false);
        quickAddInput.blur();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        quickAddInput.focus();
        quickAddInput.select();
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
  if (!isAuthenticated(request, env)) {
    return new Response(getUnauthorizedHTML(), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const userEmail = getAccessUserEmail(request) || 'unknown';

  // API routes (JSON, for browser extension)
  if (path.startsWith('/admin/api/') && request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (path === '/admin/api/records' && request.method === 'GET') {
    return handleApiRecords(env, request);
  }

  // Notes routes
  if (path === '/admin/notes') {
    return handleNotesList(env, userEmail);
  }

  if (path === '/admin/notes/new') {
    return handleNoteEditor(env, userEmail, null);
  }

  // Match /admin/notes/:key and /admin/notes/:key/delete
  const noteKeyMatch = path.match(/^\/admin\/notes\/([a-zA-Z0-9_-]+)(\/delete)?$/);
  if (noteKeyMatch) {
    const [, key, isDelete] = noteKeyMatch;
    if (isDelete && request.method === 'POST') {
      return handleNoteDelete(env, userEmail, key);
    }
    if (request.method === 'POST') {
      return handleNoteSave(request, env, userEmail, key);
    }
    return handleNoteEditor(env, userEmail, key);
  }

  // Quick-add redirect (AJAX)
  if (path === '/admin/quick-add' && request.method === 'POST') {
    return handleQuickAdd(request, env);
  }

  // Save redirects (existing)
  if (path === '/admin/save' && request.method === 'POST') {
    return handleSave(request, env, userEmail);
  }

  // Dashboard - redirects only (filter out notes)
  const records = await listAllRecords(env.REDIRECTS);
  const redirectsOnly = new Map<string, StoredRecord>();
  for (const [key, record] of records) {
    if (record.type === 'uri') {
      redirectsOnly.set(key, record);
    }
  }
  const content = serializeBulkFormat(redirectsOnly);
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

  // Delete records that are no longer in the list (in parallel)
  const keysToDelete = [...existingRecords.keys()].filter(k => !newKeys.has(k));
  await Promise.all(keysToDelete.map(key => deleteRecord(env.REDIRECTS, key)));

  // Prepare all records first (hash passwords, preserve timestamps)
  const recordsToSave: { key: string; record: typeof entries[0]['record'] }[] = [];
  await Promise.all(
    entries.map(async (entry) => {
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

      recordsToSave.push({ key: entry.key, record: entry.record });
    })
  );

  // Save all records in parallel
  await Promise.all(
    recordsToSave.map(({ key, record }) => saveRecord(env.REDIRECTS, key, record))
  );

  // Build updated content from what we just saved (avoid refetching)
  const updatedRecords = new Map<string, typeof entries[0]['record']>();
  for (const { key, record } of recordsToSave) {
    updatedRecords.set(key, record);
  }
  const updatedContent = serializeBulkFormat(updatedRecords);

  return new Response(
    getAdminDashboardHTML(updatedContent, userEmail, `Saved ${entries.length} records.`),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

/**
 * Notes list page
 */
async function handleNotesList(
  env: Env,
  userEmail: string
): Promise<Response> {
  const records = await listAllRecords(env.REDIRECTS);
  const notes: { key: string; record: StoredRecord }[] = [];

  for (const [key, record] of records) {
    if (record.type === 'note') {
      notes.push({ key, record });
    }
  }

  // Sort by updated time, newest first
  notes.sort((a, b) => {
    const timeA = a.record.updatedAt || a.record.createdAt || '';
    const timeB = b.record.updatedAt || b.record.createdAt || '';
    return timeB.localeCompare(timeA);
  });

  return new Response(getNotesListHTML(notes, userEmail), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Note editor page
 */
async function handleNoteEditor(
  env: Env,
  userEmail: string,
  key: string | null
): Promise<Response> {
  let record: StoredRecord | null = null;
  if (key) {
    record = await getRecord(env.REDIRECTS, key);
    if (!record || record.type !== 'note') {
      return new Response('Note not found', { status: 404 });
    }
  }

  return new Response(getNoteEditorHTML(key, record, userEmail), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Save note
 */
async function handleNoteSave(
  request: Request,
  env: Env,
  userEmail: string,
  key: string
): Promise<Response> {
  const formData = await request.formData();
  const content = formData.get('content') as string || '';
  const password = formData.get('password') as string || '';
  const isNew = formData.get('isNew') === 'true';

  if (!isValidKey(key)) {
    return new Response(getNoteEditorHTML(key, null, userEmail, 'Invalid key format'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Get existing record for timestamp diffing
  const existingRecord = await getRecord(env.REDIRECTS, key);

  // Build the new record
  const record: StoredRecord = {
    type: 'note',
    content,
    createdAt: existingRecord?.createdAt || new Date().toISOString(),
  };

  // Update line timestamps
  if (existingRecord && existingRecord.type === 'note') {
    record.lineTimestamps = updateLineTimestamps(
      existingRecord.content,
      content,
      existingRecord.lineTimestamps || []
    );
  } else {
    // New note - all lines get current timestamp
    record.lineTimestamps = content.split('\n').map(() => new Date().toISOString());
  }

  // Handle password
  if (password && password !== '********') {
    record.passwordHash = await hashPassword(password);
  } else if (existingRecord?.passwordHash && password === '********') {
    record.passwordHash = existingRecord.passwordHash;
  }

  await saveRecord(env.REDIRECTS, key, record);

  // Redirect back to editor with success message
  return new Response(getNoteEditorHTML(key, record, userEmail, 'Note saved successfully'), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Delete note
 */
async function handleNoteDelete(
  env: Env,
  userEmail: string,
  key: string
): Promise<Response> {
  await deleteRecord(env.REDIRECTS, key);

  // Redirect to notes list
  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/notes' },
  });
}

/**
 * Quick-add redirect via AJAX
 */
async function handleQuickAdd(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as { key?: string; url?: string };
    const { key, url } = body;

    if (!key || !url) {
      return Response.json({ success: false, error: 'Key and URL required' }, { status: 400 });
    }

    if (!isValidKey(key)) {
      return Response.json({ success: false, error: 'Invalid key format (use letters, numbers, hyphens, underscores)' }, { status: 400 });
    }

    if (!isValidUrl(url)) {
      return Response.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
    }

    // Check if key already exists
    const existing = await getRecord(env.REDIRECTS, key);
    if (existing) {
      return Response.json({ success: false, error: `Key "${key}" already exists` }, { status: 409 });
    }

    // Save the new redirect
    const record: StoredRecord = {
      type: 'uri',
      content: url,
    };
    await saveRecord(env.REDIRECTS, key, record);

    return Response.json({ success: true, key, url });
  } catch {
    return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}

/**
 * API: list all records as JSON (for browser extension)
 */
async function handleApiRecords(env: Env, request: Request): Promise<Response> {
  const records = await listAllRecords(env.REDIRECTS);
  const result: Array<{
    key: string;
    type: string;
    url?: string;
    hasPassword: boolean;
    createdAt?: string;
    updatedAt?: string;
  }> = [];

  for (const [key, record] of records) {
    result.push({
      key,
      type: record.type === 'uri' ? 'uri' : 'note',
      url: record.type === 'uri' ? record.content : undefined,
      hasPassword: !!record.passwordHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  const corsHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const origin = request.headers.get('Origin');
  if (origin) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  return new Response(JSON.stringify({ records: result }), {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Notes list HTML
 */
function getNotesListHTML(
  notes: { key: string; record: StoredRecord }[],
  userEmail: string
): string {
  const noteRows = notes.map(({ key, record }) => {
    const preview = record.content.split('\n')[0].slice(0, 60) + (record.content.length > 60 ? '...' : '');
    const updated = record.updatedAt ? formatRelativeTime(record.updatedAt) : 'unknown';
    const hasPassword = !!record.passwordHash;

    return `
      <a href="/admin/notes/${escapeHtml(key)}" class="note-item">
        <div class="note-key">${escapeHtml(key)}${hasPassword ? ' <span class="lock">🔒</span>' : ''}</div>
        <div class="note-preview">${escapeHtml(preview)}</div>
        <div class="note-meta">${updated}</div>
      </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notes - raj.quest admin</title>
  <style>
    ${getCommonStyles()}
    .note-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .note-item {
      display: grid;
      grid-template-columns: 150px 1fr 80px;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      text-decoration: none;
      color: var(--text-primary);
      transition: border-color 0.2s;
    }
    .note-item:hover {
      border-color: var(--border-hover);
    }
    .note-key {
      font-weight: 500;
      font-family: monospace;
    }
    .note-key .lock {
      font-size: 0.75rem;
    }
    .note-preview {
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .note-meta {
      text-align: right;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }
    @media (max-width: 600px) {
      .note-item {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
      .note-meta {
        text-align: left;
      }
    }
  </style>
</head>
<body class="space">
  <div class="header">
    <h1>raj.quest admin</h1>
    <div class="header-actions">
      <span class="user-email">${escapeHtml(userEmail)}</span>
      <a href="/">View Site</a>
      <a href="/cdn-cgi/access/logout" class="logout">Logout</a>
    </div>
  </div>

  <div class="tabs">
    <a href="/admin" class="tab">Redirects</a>
    <a href="/admin/notes" class="tab active">Notes</a>
  </div>

  <div class="editor-wrapper">
    <div class="actions-bar">
      <a href="/admin/notes/new" class="btn">+ New Note</a>
    </div>

    <div class="note-list">
      ${noteRows || '<div class="empty-state">No notes yet. Create your first note!</div>'}
    </div>
  </div>

  <script>
    ${getCommonScripts()}
  </script>
</body>
</html>`;
}

/**
 * Note editor HTML
 */
function getNoteEditorHTML(
  key: string | null,
  record: StoredRecord | null,
  userEmail: string,
  message?: string
): string {
  const isNew = !key;
  const content = record?.content || '';
  const hasPassword = !!record?.passwordHash;
  const lineTimestamps = record?.lineTimestamps || [];

  // Build timestamp gutter data
  const lines = content.split('\n');
  const gutterData = lines.map((_, i) => {
    const ts = lineTimestamps[i];
    return ts ? formatRelativeTime(ts) : 'new';
  });

  const messageHtml = message
    ? `<div class="message ${message.includes('error') ? 'error' : ''}">${escapeHtml(message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isNew ? 'New Note' : `Edit: ${escapeHtml(key!)}`} - raj.quest admin</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    ${getCommonStyles()}
    .editor-grid {
      display: grid;
      grid-template-columns: 60px 1fr 1fr;
      gap: 0;
      height: calc(100vh - 200px);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }
    @media (max-width: 900px) {
      .editor-grid {
        grid-template-columns: 50px 1fr;
        height: calc(100vh - 250px);
      }
      .preview-panel {
        display: none;
      }
    }
    .line-gutter {
      background: var(--bg-tertiary);
      border-right: 1px solid var(--border-color);
      padding: 1rem 0.5rem;
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.5;
      overflow-y: auto;
      text-align: right;
      user-select: none;
    }
    .line-gutter .line-ts {
      height: 1.5em;
      white-space: nowrap;
    }
    .editor-panel {
      display: flex;
      flex-direction: column;
    }
    .editor-panel textarea {
      flex: 1;
      border: none;
      border-radius: 0;
      resize: none;
      padding: 1rem;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.875rem;
      line-height: 1.5;
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .editor-panel textarea:focus {
      outline: none;
    }
    .preview-panel {
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      padding: 1rem;
      overflow-y: auto;
      line-height: 1.6;
    }
    .preview-panel h1, .preview-panel h2, .preview-panel h3 {
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    .preview-panel h1:first-child {
      margin-top: 0;
    }
    .preview-panel p { margin-bottom: 0.75em; }
    .preview-panel code {
      background: var(--bg-tertiary);
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
    }
    .preview-panel pre {
      background: var(--bg-tertiary);
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    .preview-panel pre code { background: none; padding: 0; }
    .preview-panel a { color: var(--accent); }
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
      max-width: 300px;
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
    .actions-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
    }
    .delete-btn {
      background: transparent;
      color: var(--error-text);
      border: 1px solid var(--error-border);
    }
    .delete-btn:hover {
      background: var(--error-bg);
    }
  </style>
</head>
<body class="space">
  <div class="header">
    <h1>raj.quest admin</h1>
    <div class="header-actions">
      <span class="user-email">${escapeHtml(userEmail)}</span>
      <a href="/">View Site</a>
      <a href="/cdn-cgi/access/logout" class="logout">Logout</a>
    </div>
  </div>

  <div class="tabs">
    <a href="/admin" class="tab">Redirects</a>
    <a href="/admin/notes" class="tab active">Notes</a>
  </div>

  ${messageHtml}

  <div class="editor-wrapper">
    <form method="POST" action="/admin/notes/${isNew ? 'new' : escapeHtml(key!)}" id="note-form">
      <input type="hidden" name="isNew" value="${isNew}" />

      <div class="form-row">
        <label for="note-key">Key (URL path):</label>
        <input type="text" id="note-key" name="key" value="${escapeHtml(key || '')}"
               placeholder="my-note" pattern="[a-zA-Z0-9_-]+" required ${!isNew ? 'readonly' : ''} />
      </div>

      <div class="form-row">
        <label for="note-password">Password (optional):</label>
        <input type="text" id="note-password" name="password"
               value="${hasPassword ? '********' : ''}"
               placeholder="Leave empty for public" />
      </div>

      <div class="editor-grid">
        <div class="line-gutter" id="line-gutter">
          ${gutterData.map(ts => `<div class="line-ts">${ts}</div>`).join('')}
        </div>
        <div class="editor-panel">
          <textarea name="content" id="editor" oninput="updatePreview(); updateGutter();"
                    onscroll="syncScroll()">${escapeHtml(content)}</textarea>
        </div>
        <div class="preview-panel" id="preview"></div>
      </div>

      <div class="actions-row">
        <div>
          <button type="submit" class="btn">Save Note</button>
          <a href="/admin/notes" class="btn secondary">Cancel</a>
        </div>
        ${!isNew ? `
          <form method="POST" action="/admin/notes/${escapeHtml(key!)}/delete"
                onsubmit="return confirm('Delete this note?');" style="display:inline;">
            <button type="submit" class="btn delete-btn">Delete</button>
          </form>
        ` : ''}
      </div>
    </form>
  </div>

  <script>
    ${getCommonScripts()}

    // Line timestamps (from server)
    let lineTimestamps = ${JSON.stringify(gutterData)};

    function updatePreview() {
      const content = document.getElementById('editor').value;
      const preview = document.getElementById('preview');
      if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(content);
      } else {
        preview.textContent = content;
      }
    }

    function updateGutter() {
      const content = document.getElementById('editor').value;
      const lines = content.split('\\n');
      const gutter = document.getElementById('line-gutter');

      // Adjust timestamps array if needed
      while (lineTimestamps.length < lines.length) {
        lineTimestamps.push('new');
      }
      lineTimestamps.length = lines.length;

      gutter.innerHTML = lineTimestamps.map(ts => '<div class="line-ts">' + ts + '</div>').join('');
    }

    function syncScroll() {
      const editor = document.getElementById('editor');
      const gutter = document.getElementById('line-gutter');
      gutter.scrollTop = editor.scrollTop;
    }

    // Initialize
    updatePreview();

    // Handle new note key -> update form action
    ${isNew ? `
    document.getElementById('note-key').addEventListener('input', function() {
      const key = this.value.trim();
      if (key && /^[a-zA-Z0-9_-]+$/.test(key)) {
        document.getElementById('note-form').action = '/admin/notes/' + key;
      }
    });
    ` : ''}

    // Keyboard shortcut
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('note-form').submit();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Common styles for admin pages
 */
function getCommonStyles(): string {
  return `
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
    body.space {
      --bg-primary: #050510;
      --bg-secondary: rgba(10, 10, 30, 0.95);
      --bg-tertiary: rgba(20, 20, 50, 0.95);
      --text-primary: #e8e8ff;
      --text-secondary: #b0b0e0;
      --text-muted: #8080b0;
      --border-color: rgba(120, 100, 220, 0.3);
      --border-hover: rgba(160, 140, 255, 0.5);
      --accent: #a78bfa;
      --accent-hover: #8b5cf6;
    }
    body.space::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #050510;
      z-index: -2;
    }
    body.space::after {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(ellipse 80% 50% at 20% 60%, rgba(100, 50, 180, 0.15), transparent),
        radial-gradient(ellipse 60% 40% at 80% 30%, rgba(50, 100, 180, 0.12), transparent),
        radial-gradient(2px 2px at 10% 15%, #fff, transparent),
        radial-gradient(2px 2px at 30% 25%, #fff, transparent),
        radial-gradient(2px 2px at 50% 10%, #fff, transparent),
        radial-gradient(2px 2px at 70% 35%, #fff, transparent),
        radial-gradient(2px 2px at 90% 20%, #fff, transparent),
        radial-gradient(1px 1px at 15% 55%, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 35% 70%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 55% 45%, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 75% 65%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 95% 55%, rgba(255,255,255,0.5), transparent);
      z-index: -1;
      animation: twinkle 4s ease-in-out infinite;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.92; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    h1 { font-size: 1.25rem; font-weight: 500; }
    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .user-email { color: var(--text-muted); font-size: 0.875rem; }
    .header-actions a { color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; }
    .header-actions a:hover { color: var(--text-primary); }
    .header-actions a.logout { color: var(--error-text); }
    .tabs {
      display: flex;
      gap: 0;
      max-width: 1200px;
      margin: 0 auto 1rem;
    }
    .tab {
      padding: 0.75rem 1.5rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-bottom: none;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .tab:first-child { border-radius: 4px 0 0 0; }
    .tab:last-child { border-radius: 0 4px 0 0; }
    .tab.active {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-bottom: 1px solid var(--bg-secondary);
      margin-bottom: -1px;
    }
    .tab:hover:not(.active) { background: var(--bg-secondary); }
    .editor-wrapper {
      max-width: 1200px;
      margin: 0 auto;
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
      border-color: var(--error-border);
      color: var(--error-text);
    }
    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn.secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }
    .btn.secondary:hover {
      background: var(--bg-secondary);
      border-color: var(--border-hover);
    }
    .actions-bar {
      margin-bottom: 1rem;
    }
  `;
}

/**
 * Common scripts for admin pages
 */
function getCommonScripts(): string {
  return `
    // Apply space theme by default
    const savedTheme = localStorage.getItem('raj-admin-theme') || 'space';
    if (savedTheme === 'space') {
      document.body.classList.add('space');
    }
  `;
}
