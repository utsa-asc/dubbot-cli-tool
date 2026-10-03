#!/usr/bin/env node
// Guard for sites-directory.csv: the dashboard must never carry personal data.
//
//   node scripts/check-directory.mjs <in.csv>            check only
//   node scripts/check-directory.mjs <in.csv> <out.csv>  check, then write a copy
//
// Fails (exit 1) if the file has any column outside the allow-list or any cell
// that looks like an email address, or a Dubbot URL that is not https on
// dubbot.com. Values are never printed, only column names and row numbers.
// Also usable as a pre-commit hook for the `data` branch.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseCSV } = require('../dashboard/js/load.js');
const { isSafeDubbotUrl } = require('../dashboard/js/model.js');
const ALLOWED = ['Site ID', 'Display URL', 'List', 'Dubbot URL'];

const [, , input, output] = process.argv;
if (!input) {
  console.error('usage: check-directory.mjs <in.csv> [out.csv]');
  process.exit(1);
}

const rows = parseCSV(fs.readFileSync(input, 'utf8'));
if (!rows.length) {
  console.error(`${input}: empty file`);
  process.exit(1);
}

const header = rows[0].map((h) => h.trim());
const problems = [];

const extra = header.filter((h) => !ALLOWED.includes(h));
if (extra.length) problems.push(`columns not allowed: ${extra.map((h) => JSON.stringify(h)).join(', ')} (allowed: ${ALLOWED.join(', ')})`);
const missing = ALLOWED.filter((h) => !header.includes(h));
if (missing.length) problems.push(`missing columns: ${missing.join(', ')}`);

const urlCol = header.indexOf('Dubbot URL');
rows.slice(1).forEach((r, i) => {
  if (r.some((v) => /@/.test(v))) problems.push(`row ${i + 2}: contains "@" (looks like an email address)`);
  const url = (r[urlCol] || '').trim();
  if (url && !isSafeDubbotUrl(url)) {
    problems.push(`row ${i + 2}: "Dubbot URL" is not an https link on dubbot.com`);
  }
});

if (problems.length) {
  console.error(`${input} failed the directory check:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

if (output) {
  const keep = ALLOWED.map((h) => header.indexOf(h));
  const quote = (v) => (/[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  fs.writeFileSync(output, rows.map((r) => keep.map((i) => quote(r[i] ?? '')).join(',')).join('\n') + '\n');
}
console.log(`${input}: OK (${rows.length - 1} sites)${output ? ' -> ' + output : ''}`);
