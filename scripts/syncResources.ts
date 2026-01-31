#!/usr/bin/env npx tsx

/**
 * CLI script to sync all learning resources from the data folder
 *
 * Usage:
 *   npx tsx scripts/syncResources.ts [--dry-run]
 *
 * Options:
 *   --dry-run, -d       Validate and show what would be imported without making changes
 *   --help, -h          Show this help message
 */

import { parseArgs } from 'util';
import { importAllResources, getDataFiles } from '../lib/resources/importer';
import { closeConnection } from '../lib/db';

function showHelp(): void {
  console.log(`
Learning Resource Sync

Sync all learning resources from JSON files in the data folder into the database.
Automatically processes all .json files in lib/resources/data/

Usage:
  npx tsx scripts/syncResources.ts [options]
  npm run resources:sync [-- --dry-run]

Options:
  --dry-run, -d       Validate and show what would be imported without making changes
  --help, -h          Show this help message

Data folder: lib/resources/data/
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', short: 'd', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    },
    allowPositionals: false
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  try {
    const files = getDataFiles();

    if (files.length === 0) {
      console.log('No JSON files found in lib/resources/data/');
      console.log('Add resource files to sync.');
      process.exit(0);
    }

    console.log('Learning Resource Sync');
    console.log('='.repeat(60));
    console.log(`Data folder: lib/resources/data/`);
    console.log(`Files found: ${files.join(', ')}`);

    if (values['dry-run']) {
      console.log('\n[DRY RUN MODE - No changes will be made]\n');
    }

    const result = await importAllResources({
      dryRun: values['dry-run']
    });

    await closeConnection();

    // Check if any failures occurred
    const hasFailures = result.results.some((r) => 'error' in r.result || ('failureCount' in r.result && r.result.failureCount > 0));

    if (hasFailures) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    await closeConnection();
    process.exit(1);
  }
}

main();
