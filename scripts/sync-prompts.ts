/**
 * Script to sync local agent prompts to Opik prompt management.
 */
import { syncPromptsToOpik } from '../lib/prompts';

async function main() {
  console.log('Starting prompt sync to Opik...\n');

  try {
    await syncPromptsToOpik();
    console.log('\nPrompt sync completed successfully!');
  } catch (error) {
    console.error('\nPrompt sync failed:', error);
    process.exit(1);
  }
}

main();
