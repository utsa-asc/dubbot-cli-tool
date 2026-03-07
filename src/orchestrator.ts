import fs from 'fs';
import { config } from './config.js';
import { fetchSiteStats } from './clients/dubbot.js';
import { writeRows } from './writers/csv.js';
import { logger } from './utils/logger.js';
import type { SnapshotRow } from './models/SnapshotRow.js';

export interface RunOptions {
  sites?: string[];
  sitesFile?: string;
  out?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

function readSiteIdsFromFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ids = content
    .split('\n')
    .flatMap((line) => line.split(','))
    .map((s) => s.trim())
    .filter(Boolean);

  // Skip first entry if it looks like a header (not a 24-char hex ObjectID)
  if (ids.length > 0 && !/^[0-9a-f]{24}$/i.test(ids[0])) {
    return ids.slice(1);
  }
  return ids;
}

export async function run(options: RunOptions = {}): Promise<void> {
  let siteIds: string[];
  if (options.sites) {
    siteIds = options.sites;
  } else if (options.sitesFile) {
    siteIds = readSiteIdsFromFile(options.sitesFile);
    logger.info({ sitesFile: options.sitesFile, count: siteIds.length }, 'Loaded site IDs from file');
  } else {
    siteIds = config.DUBBOT_SITE_IDS;
  }

  if (siteIds.length === 0) {
    logger.error('No site IDs provided — pass --sites, --sites-file, or set DUBBOT_SITE_IDS');
    process.exitCode = 2;
    return;
  }

  const outputPath = options.dryRun ? undefined : (options.out ?? config.OUTPUT_FILE);
  const collectedAt = new Date().toISOString();

  logger.info({ siteIds, outputPath, dryRun: options.dryRun }, 'Starting run');

  const results = await Promise.allSettled(
    siteIds.map((siteId) => fetchSiteStats(siteId)),
  );

  const rows: SnapshotRow[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const siteId = siteIds[i];
    if (result.status === 'fulfilled') {
      rows.push({ collectedAt, ...result.value });
      if (options.verbose) {
        logger.info({ siteId, data: result.value }, 'Fetched site stats');
      }
    } else {
      logger.error({ siteId, err: result.reason }, 'Failed to fetch site stats');
    }
  }

  if (rows.length === 0) {
    logger.error('No sites succeeded — exiting with code 2');
    process.exitCode = 2;
    return;
  }

  writeRows(rows, outputPath);

  const destination = outputPath ?? 'stdout';
  logger.info({ count: rows.length, destination }, `${rows.length} site(s) written to ${destination}`);
}
