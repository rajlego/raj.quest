/**
 * Migration script for raj.quest
 *
 * Converts the old file-based storage format to the new bulk editor format.
 *
 * Old format (each file in db/ folder):
 * - Filename: the key (e.g., "github")
 * - Content line 1: type.id[.hash] (e.g., "uri.github" or "note.mypost.abc123hash")
 * - Content rest: the actual content
 *
 * New format (bulk editor text):
 * - key -> url for redirects
 * - key [password] -> url for password-protected redirects (password needs to be re-set)
 * - key ---\n...\n--- for notes
 *
 * Usage:
 *   npx ts-node migration/migrate.ts [db_path]
 *
 * The script will output the bulk editor format to stdout.
 * Redirect to a file if you want to save it:
 *   npx ts-node migration/migrate.ts db > redirects.txt
 *
 * Note: Old password hashes cannot be migrated (different hash algorithm).
 * Password-protected records will be marked with [RESET_PASSWORD] placeholder.
 */

import * as fs from 'fs';
import * as path from 'path';

interface OldRecord {
  id: string;
  type: 'uri' | 'note';
  hash?: string;
  content: string;
}

/**
 * Parse an old-format record file
 */
function parseOldRecord(filename: string, content: string): OldRecord | null {
  const lines = content.split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const contentLines = lines.slice(1);

  const parts = firstLine.split('.');
  if (parts.length < 2) {
    console.error(`Invalid record format in ${filename}: ${firstLine}`);
    return null;
  }

  const [type, id, hash] = parts;

  if (type !== 'uri' && type !== 'note') {
    console.error(`Unknown type in ${filename}: ${type}`);
    return null;
  }

  return {
    id,
    type: type as 'uri' | 'note',
    hash: hash || undefined,
    content: contentLines.join('\n').trim(),
  };
}

/**
 * Escape a string for the bulk format
 */
function escapeForBulk(s: string): string {
  // Currently no escaping needed, but could add if needed
  return s;
}

/**
 * Convert records to bulk editor format
 */
function toBulkFormat(records: OldRecord[]): string {
  const lines: string[] = [
    '# raj.quest Redirects',
    '# Migrated from old file-based format',
    '#',
    '# Format: key -> url',
    '# Password protected: key [password] -> url',
    '# Notes: key ---',
    '#        content here',
    '#        ---',
    '#',
    '# NOTE: Password-protected records have [RESET_PASSWORD] placeholder.',
    '# You must set new passwords for these records.',
    '',
  ];

  // Sort records by ID
  records.sort((a, b) => a.id.localeCompare(b.id));

  for (const record of records) {
    const passwordPlaceholder = record.hash ? ' [RESET_PASSWORD]' : '';

    if (record.type === 'uri') {
      lines.push(`${record.id}${passwordPlaceholder} -> ${record.content}`);
    } else if (record.type === 'note') {
      lines.push(`${record.id}${passwordPlaceholder} ---`);
      lines.push(record.content);
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Main migration function
 */
function migrate(dbPath: string): void {
  if (!fs.existsSync(dbPath)) {
    console.error(`Database directory not found: ${dbPath}`);
    console.error('');
    console.error('Usage: npx ts-node migration/migrate.ts [db_path]');
    console.error('');
    console.error('If you don\'t have existing data, you can skip migration');
    console.error('and start fresh with the new admin interface.');
    process.exit(1);
  }

  const stats = fs.statSync(dbPath);
  if (!stats.isDirectory()) {
    console.error(`Not a directory: ${dbPath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dbPath);
  const records: OldRecord[] = [];

  for (const filename of files) {
    // Skip hidden files and directories
    if (filename.startsWith('.')) continue;

    const filePath = path.join(dbPath, filename);
    const fileStats = fs.statSync(filePath);

    if (fileStats.isFile()) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const record = parseOldRecord(filename, content);
      if (record) {
        records.push(record);
      }
    }
  }

  if (records.length === 0) {
    console.error('No records found in database directory.');
    console.error('');
    console.error('If the directory is empty, you can start fresh with');
    console.error('the new admin interface.');
    process.exit(1);
  }

  // Output bulk format
  const output = toBulkFormat(records);
  console.log(output);

  // Summary to stderr
  console.error('');
  console.error('=== Migration Summary ===');
  console.error(`Total records: ${records.length}`);
  console.error(`  URIs: ${records.filter(r => r.type === 'uri').length}`);
  console.error(`  Notes: ${records.filter(r => r.type === 'note').length}`);
  console.error(`  Password-protected: ${records.filter(r => r.hash).length}`);
  console.error('');
  console.error('Next steps:');
  console.error('1. Review the output above');
  console.error('2. Replace [RESET_PASSWORD] with actual passwords');
  console.error('3. Paste into the admin editor at raj.quest/admin');
  console.error('4. Save to apply changes');
}

// Run migration
const dbPath = process.argv[2] || 'db';
migrate(dbPath);
