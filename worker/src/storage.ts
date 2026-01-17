/**
 * KV Storage layer for raj.quest redirects
 */

export interface StoredRecord {
  type: 'uri' | 'note';
  content: string;
  passwordHash?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Env {
  REDIRECTS: KVNamespace;
  ALLOWED_ADMIN_EMAILS?: string; // Comma-separated list of allowed admin emails
  ENVIRONMENT?: string;
}

// System keys that shouldn't be modified via bulk editor
const SYSTEM_KEYS = ['__ADMIN_PASSWORD_HASH__', '__RATE_LIMITS__'];

export function isSystemKey(key: string): boolean {
  return SYSTEM_KEYS.includes(key) || key.startsWith('__');
}

/**
 * Get a record from KV storage
 */
export async function getRecord(
  kv: KVNamespace,
  key: string
): Promise<StoredRecord | null> {
  const data = await kv.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as StoredRecord;
  } catch {
    return null;
  }
}

/**
 * Save a record to KV storage
 */
export async function saveRecord(
  kv: KVNamespace,
  key: string,
  record: StoredRecord
): Promise<void> {
  const now = new Date().toISOString();
  const toSave: StoredRecord = {
    ...record,
    updatedAt: now,
    createdAt: record.createdAt || now,
  };
  await kv.put(key, JSON.stringify(toSave));
}

/**
 * Delete a record from KV storage
 */
export async function deleteRecord(
  kv: KVNamespace,
  key: string
): Promise<void> {
  await kv.delete(key);
}

/**
 * Check if a record exists
 */
export async function hasRecord(
  kv: KVNamespace,
  key: string
): Promise<boolean> {
  const data = await kv.get(key);
  return data !== null;
}

/**
 * List all records (excluding system keys)
 * Note: KV list has eventual consistency, may not include very recent writes
 */
export async function listAllRecords(
  kv: KVNamespace
): Promise<Map<string, StoredRecord>> {
  const records = new Map<string, StoredRecord>();
  let cursor: string | undefined;

  do {
    const result = await kv.list({ cursor });
    for (const key of result.keys) {
      if (!isSystemKey(key.name)) {
        const record = await getRecord(kv, key.name);
        if (record) {
          records.set(key.name, record);
        }
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return records;
}

/**
 * Get admin password hash from KV
 */
export async function getAdminPasswordHash(
  kv: KVNamespace
): Promise<string | null> {
  return await kv.get('__ADMIN_PASSWORD_HASH__');
}

/**
 * Set admin password hash in KV
 */
export async function setAdminPasswordHash(
  kv: KVNamespace,
  hash: string
): Promise<void> {
  await kv.put('__ADMIN_PASSWORD_HASH__', hash);
}

/**
 * Parse the bulk editor text format into records
 * Format:
 * - Lines starting with # are comments
 * - key -> url for simple redirects
 * - key [password] -> url for password-protected redirects
 * - key ---\n...\n--- for multi-line markdown notes
 * - key [password] ---\n...\n--- for password-protected notes
 */
export interface ParsedEntry {
  key: string;
  record: StoredRecord;
  rawPassword?: string; // Only set for new password entries
}

export interface ParseResult {
  entries: ParsedEntry[];
  errors: string[];
}

export function parseBulkFormat(text: string): ParseResult {
  const lines = text.split('\n');
  const entries: ParsedEntry[] = [];
  const errors: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      i++;
      continue;
    }

    // Check for note block: key ---
    const noteMatch = line.match(
      /^([a-zA-Z0-9_-]+)\s*(?:\[([^\]]+)\])?\s*---$/
    );
    if (noteMatch) {
      const [, key, password] = noteMatch;
      const contentLines: string[] = [];
      i++;

      // Read until closing ---
      while (i < lines.length && lines[i].trim() !== '---') {
        contentLines.push(lines[i]);
        i++;
      }

      if (i >= lines.length) {
        errors.push(`Unclosed note block for key "${key}" starting at line ${i - contentLines.length}`);
      } else {
        i++; // Skip closing ---
        const entry: ParsedEntry = {
          key,
          record: {
            type: 'note',
            content: contentLines.join('\n'),
          },
        };
        if (password) {
          entry.rawPassword = password;
        }
        entries.push(entry);
      }
      continue;
    }

    // Check for redirect: key -> url or key [password] -> url
    const redirectMatch = line.match(
      /^([a-zA-Z0-9_-]+)\s*(?:\[([^\]]+)\])?\s*->\s*(.+)$/
    );
    if (redirectMatch) {
      const [, key, password, url] = redirectMatch;
      const entry: ParsedEntry = {
        key,
        record: {
          type: 'uri',
          content: url.trim(),
        },
      };
      if (password) {
        entry.rawPassword = password;
      }
      entries.push(entry);
      i++;
      continue;
    }

    // Unrecognized line
    errors.push(`Unrecognized format at line ${i + 1}: "${line}"`);
    i++;
  }

  return { entries, errors };
}

/**
 * Serialize records back to bulk editor format
 */
export function serializeBulkFormat(records: Map<string, StoredRecord>): string {
  const lines: string[] = [
    '# raj.quest Redirects',
    '# Format: key -> url',
    '# Password protected: key [password] -> url',
    '# Notes: key ---',
    '#        content here',
    '#        ---',
    '',
  ];

  // Sort keys alphabetically
  const sortedKeys = Array.from(records.keys()).sort();

  for (const key of sortedKeys) {
    const record = records.get(key)!;
    const hasPassword = !!record.passwordHash;
    const passwordPlaceholder = hasPassword ? ' [********]' : '';

    if (record.type === 'uri') {
      lines.push(`${key}${passwordPlaceholder} -> ${record.content}`);
    } else if (record.type === 'note') {
      lines.push(`${key}${passwordPlaceholder} ---`);
      lines.push(record.content);
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Validate a key
 */
export function isValidKey(key: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(key) && key.length > 0 && key.length <= 100;
}

/**
 * Validate a URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
