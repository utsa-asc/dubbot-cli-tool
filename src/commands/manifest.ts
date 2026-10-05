import fs from 'node:fs';
import path from 'node:path';

export type SnapshotList = 'main' | 'dls' | 'backfill';

export interface ManifestFile {
  name: string;
  list: SnapshotList;
  collectedAt?: string;
  rows: number;
}

export interface Manifest {
  generatedAt: string;
  files: ManifestFile[];
}

function listFor(name: string): SnapshotList {
  if (name.startsWith('snapshots-backfill')) return 'backfill';
  if (name.startsWith('snapshots-dls-')) return 'dls';
  return 'main';
}

export function buildManifest(dir: string): Manifest {
  const files: ManifestFile[] = fs
    .readdirSync(dir)
    .filter((n) => /^snapshots.*\.csv$/.test(n))
    .sort()
    .map((name) => {
      const lines = fs
        .readFileSync(path.join(dir, name), 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '');
      const body = lines.slice(1);
      const entry: ManifestFile = { name, list: listFor(name), rows: body.length };
      if (body.length > 0) entry.collectedAt = body[0].split(',')[0];
      return entry;
    });
  return { generatedAt: new Date().toISOString(), files };
}

// Written to a temp file and renamed so a reader never sees a partial manifest.
export function writeManifest(dir: string): Manifest {
  const manifest = buildManifest(dir);
  const target = path.join(dir, 'manifest.json');
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(tmp, target);
  return manifest;
}
