#!/usr/bin/env node
// Write manifest.json for a folder of snapshot CSVs (the dashboard reads it to
// find the files). Plain Node, no dependencies and no DubBot credentials, so it
// runs anywhere, including the Pages build job that has no secrets.
//
//   node scripts/build-manifest.mjs <folder>
//
// List tags come from the file name: snapshots-dls-* is "dls",
// snapshots-backfill* is "backfill", anything else is "main".
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('usage: build-manifest.mjs <folder containing snapshots*.csv>');
  process.exit(1);
}

const listFor = (name) =>
  name.startsWith('snapshots-backfill') ? 'backfill' : name.startsWith('snapshots-dls-') ? 'dls' : 'main';

const files = fs
  .readdirSync(dir)
  .filter((n) => /^snapshots.*\.csv$/.test(n))
  .sort()
  .map((name) => {
    const lines = fs
      .readFileSync(path.join(dir, name), 'utf8')
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '');
    const body = lines.slice(1);
    const entry = { name, list: listFor(name), rows: body.length };
    if (body.length > 0) entry.collectedAt = body[0].split(',')[0];
    return entry;
  });

const manifest = { generatedAt: new Date().toISOString(), files };
// Write to a temp file and rename so a reader never sees a partial manifest.
const target = path.join(dir, 'manifest.json');
fs.writeFileSync(`${target}.tmp`, JSON.stringify(manifest, null, 2) + '\n');
fs.renameSync(`${target}.tmp`, target);
console.log(`Wrote ${target} (${files.length} files)`);
