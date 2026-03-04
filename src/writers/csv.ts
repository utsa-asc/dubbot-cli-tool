import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import { SNAPSHOT_HEADERS, toRow, type SnapshotRow } from '../models/SnapshotRow.js';

export function writeRows(rows: SnapshotRow[], outputPath?: string): void {
  const fileExists = outputPath != null && fs.existsSync(outputPath);
  const data: string[][] = fileExists
    ? rows.map(toRow)
    : [SNAPSHOT_HEADERS, ...rows.map(toRow)];

  const csv = stringify(data);

  if (outputPath != null) {
    fs.appendFileSync(outputPath, csv);
  } else {
    process.stdout.write(csv);
  }
}
