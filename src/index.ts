#!/usr/bin/env node
import { program } from 'commander';
import { run } from './orchestrator.js';
import { config } from './config.js';
import { fetchSiteStats } from './clients/dubbot.js';
import { logger } from './utils/logger.js';

program
  .name('dubbot-stats')
  .description('Fetch DubBot accessibility stats and output CSV snapshots')
  .version('1.0.0');

program
  .command('run', { isDefault: true })
  .description('Fetch stats for all configured sites and output CSV')
  .option('-s, --sites <ids>', 'Comma-separated DubBot site IDs (overrides env var)')
  .option('-f, --sites-file <path>', 'CSV file of site IDs, one per line (overrides env var)')
  .option('-o, --out <file>', 'Output CSV file path (appends if exists; default: stdout)')
  .option('--dry-run', 'Fetch data and print to stdout regardless of --out setting')
  .option('--verbose', 'Print full API response payloads to stderr')
  .option('--no-header', 'Skip writing the header row')
  .action(async (opts) => {
    const sites = opts.sites ? opts.sites.split(',').map((s: string) => s.trim()) : undefined;
    await run({
      sites,
      sitesFile: opts.sitesFile,
      out: opts.out,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });
  });

program
  .command('validate')
  .description('Validate config and API connectivity (no CSV written)')
  .action(async () => {
    try {
      const siteId = config.DUBBOT_SITE_IDS[0];
      logger.info({ siteId }, 'Validating config and API connectivity');
      const result = await fetchSiteStats(siteId);
      logger.info({ result }, 'OK — API connection successful');
      console.log(`OK — connected to DubBot API, site: ${result.siteUrl}`);
    } catch (err) {
      logger.error({ err }, 'Validation failed');
      console.error(`ERROR — ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 2;
    }
  });

program
  .command('list-sites')
  .description('List all sites accessible with the configured API key')
  .action(() => {
    console.log('TODO: list-sites not yet implemented');
    process.exitCode = 0;
  });

program
  .command('schema')
  .description('Introspect and print the DubBot GraphQL schema')
  .action(() => {
    console.log('TODO: schema not yet implemented');
    process.exitCode = 0;
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err }, 'Unhandled error');
  process.exitCode = 1;
});
