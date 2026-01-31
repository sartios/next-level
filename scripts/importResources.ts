#!/usr/bin/env npx tsx

/**
 * CLI script to import learning resources from a JSON file
 *
 * Usage:
 *   npx tsx scripts/importResources.ts --file resources.json [--dry-run] [--skip-embeddings]
 *
 * Options:
 *   --file, -f          Path to the JSON file containing resources (required)
 *   --dry-run, -d       Validate and show what would be imported without making changes
 *   --skip-embeddings   Skip generating embeddings (faster for testing)
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
  --skip-embeddings   Skip generating embeddings (faster for testing)
  --validate-only     Only validate the JSON file structure
  --help, -h          Show this help message

Example JSON format:
{
  "career": "data-scientist",
  "resources": [
    {
      "skill": "Python",
      "level": "beginner",
      "url": "https://www.udemy.com/course/python-course/",
      "title": "Complete Python Course",
      "provider": "udemy",
      "resourceType": "course",
      "description": "Learn Python from scratch...",
      "learningObjectives": ["Python basics", "Data structures"],
      "totalHours": 10,
      "sections": [
        { "title": "Introduction", "estimatedMinutes": 15 },
        { "title": "Variables", "estimatedMinutes": 45 }
      ]
    }
  ]
}

Required fields per resource:
  - skill: The skill this resource teaches
  - level: beginner | intermediate | expert
  - url: Full URL to the resource (must be unique)
  - title: Title of the resource
  - provider: Platform name (udemy, coursera, oreilly, etc.)
  - resourceType: course | book | tutorial | article

Optional fields:
  - description: Detailed description
  - learningObjectives: Array of learning outcomes
  - totalHours: Estimated completion time
  - sections: Array of { title, estimatedMinutes }
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', short: 'f' },
      'dry-run': { type: 'boolean', short: 'd', default: false },
      'skip-embeddings': { type: 'boolean', default: false },
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
        console.log('✓ File is valid');
        console.log(`  Career: ${result.data!.career}`);
        console.log(`  Resources: ${result.data!.resources.length}`);

        const skills = new Set(result.data!.resources.map((r) => r.skill));
        console.log(`  Unique skills: ${skills.size}`);

        const levels = result.data!.resources.reduce(
          (acc, r) => {
            acc[r.level] = (acc[r.level] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        console.log(`  By level:`, levels);

        process.exit(0);
      } else {
        console.error('✗ Validation failed:');
        console.error(result.error);
        process.exit(1);
      }
    }

    const result = await importResourcesFromJson(values.file, {
      dryRun: values['dry-run'],
      skipEmbeddings: values['skip-embeddings']
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
