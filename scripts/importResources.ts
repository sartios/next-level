#!/usr/bin/env npx tsx

/**
 * CLI script to import learning resources from a JSON file
 *
 * Usage:
 *   npx tsx scripts/importResources.ts --file resources.json [--dry-run]
 *
 * Options:
 *   --file, -f          Path to the JSON file containing resources (required)
 *   --dry-run, -d       Validate and show what would be imported without making changes
 *   --validate-only     Only validate the JSON file structure
 *   --help, -h          Show this help message
 */

import { parseArgs } from 'util';
import { importResourcesFromJson, validateImportFile } from '../lib/resources/importer';
import { closeConnection } from '../lib/db';

function showHelp(): void {
  console.log(`
Learning Resource Importer

Import learning resources from a JSON file into the database.

Usage:
  npx tsx scripts/importResources.ts --file <path> [options]

Options:
  --file, -f          Path to the JSON file containing resources (required)
  --dry-run, -d       Validate and show what would be imported without making changes
  --validate-only     Only validate the JSON file structure
  --help, -h          Show this help message

Example JSON format:
{
  "resources": [
    {
      "url": "https://www.udemy.com/course/python-course/",
      "title": "Complete Python Course",
      "provider": "udemy",
      "resourceType": "course",
      "description": "Learn Python from scratch...",
      "learningObjectives": ["Python basics", "Data structures"],
      "targetAudience": ["Beginners", "Career changers"],
      "totalHours": 10,
      "sections": [
        { "title": "Introduction", "estimatedMinutes": 15 },
        { "title": "Variables", "estimatedMinutes": 45 }
      ]
    }
  ]
}

Required fields per resource:
  - url: Full URL to the resource (must be unique)
  - title: Title of the resource
  - provider: Platform name (udemy, coursera, oreilly, etc.)
  - resourceType: course | book | tutorial | article

Optional fields:
  - description: Detailed description
  - learningObjectives: Array of learning outcomes
  - targetAudience: Array of target audience descriptions
  - totalHours: Estimated completion time
  - sections: Array of { title, estimatedMinutes, topics }
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', short: 'f' },
      'dry-run': { type: 'boolean', short: 'd', default: false },
      'validate-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    },
    allowPositionals: false
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  if (!values.file) {
    console.error('Error: --file is required\n');
    showHelp();
    process.exit(1);
  }

  try {
    if (values['validate-only']) {
      console.log(`Validating file: ${values.file}\n`);
      const result = validateImportFile(values.file);

      if (result.valid) {
        console.log('Valid file');
        console.log(`  Resources: ${result.data!.resources.length}`);

        const providers = new Set(result.data!.resources.map((r) => r.provider));
        console.log(`  Providers: ${[...providers].join(', ')}`);

        const types = result.data!.resources.reduce(
          (acc, r) => {
            acc[r.resourceType] = (acc[r.resourceType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        console.log(`  By type:`, types);

        process.exit(0);
      } else {
        console.error('Validation failed:');
        console.error(result.error);
        process.exit(1);
      }
    }

    const result = await importResourcesFromJson(values.file, {
      dryRun: values['dry-run']
    });

    await closeConnection();

    if (result.failureCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    await closeConnection();
    process.exit(1);
  }
}

main();
