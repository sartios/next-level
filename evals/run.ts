import 'dotenv/config';

import { Opik, evaluate, type EvaluationTask, type BaseMetric, generateId, Hallucination, AnswerRelevance, Usefulness } from 'opik';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { skillResourceRetrieverTask } from './tasks/skillResourceRetrieverTask.js';
import { userSkillAgentTask } from './tasks/userSkillAgentTask.js';
import { challengeGeneratorAgentTask } from './tasks/challengeGeneratorAgentTask.js';
import { seedUserSkillAgentData, seedSkillResourceRetrieverData, seedChallengeGeneratorData } from './seed.js';
import { UserSkillDatasetItem, SkillResourceDatasetItem, ChallengeGeneratorDatasetItem } from './types.js';

// Dataset item type compatible with Opik's DatasetItemData
type DatasetItem = {
  [key: string]: unknown;
  id: string;
  name: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI argument parsing
type DatasetSource = 'local' | 'opik';

interface CliArgs {
  agent?: string;
  all?: boolean;
  samples?: number;
  verbose?: boolean;
  source?: DatasetSource;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { source: 'local' }; // Default to local
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--agent' && argv[i + 1]) {
      args.agent = argv[++i];
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--samples' && argv[i + 1]) {
      args.samples = parseInt(argv[++i], 10);
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else if (arg === '--source' && argv[i + 1]) {
      const source = argv[++i];
      if (source === 'local' || source === 'opik') {
        args.source = source;
      } else {
        console.error(`Error: Invalid source "${source}". Must be "local" or "opik".`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Opik Evaluation Runner

Usage:
  npx tsx evals/run.ts [options]

Options:
  --agent <name>   Run evaluation for a specific agent
  --all            Run all evaluations
  --samples <n>    Limit the number of samples to evaluate
  --source <src>   Dataset source: "local" (JSON files) or "opik" (Opik platform)
                   Default: local
  --verbose        Show detailed output
  --help, -h       Show this help message

Available agents:
  user-skill-agent         Evaluates skill suggestions for career development
  skill-resource-retriever Evaluates learning resource retrieval quality
  challenge-generator      Evaluates quiz question generation quality

Dataset Sources:
  local  - Load from local JSON files in evals/datasets/
  opik   - Load from Opik platform (includes items created in Opik UI)

Metrics (Opik built-in):
  - Hallucination: Checks if output is grounded in context
  - AnswerRelevance: Checks if output is relevant to the input
  - Usefulness: Checks if output is useful for the user

Examples:
  npx tsx evals/run.ts --agent user-skill-agent
  npx tsx evals/run.ts --agent user-skill-agent --source opik
  npx tsx evals/run.ts --agent skill-resource-retriever --verbose
  npx tsx evals/run.ts --agent challenge-generator --samples 2
  npx tsx evals/run.ts --all --samples 2 --source opik
      `);
      process.exit(0);
    }
  }

  return args;
}

// Load dataset from JSON file
// NOTE: These datasets are shared with optimize/run_optimization.py
// See evals/datasets/README.md for schema documentation
function loadDatasetItems(filename: string): DatasetItem[] {
  const filePath = path.join(__dirname, 'datasets', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Agent configurations
interface AgentConfig {
  name: string;
  datasetFile: string;
  datasetName: string;
  task: EvaluationTask<DatasetItem>;
  metrics: BaseMetric[];
  seedData: (items: DatasetItem[]) => Promise<void>;
}

// Initialize built-in metrics
const LLM_AS_A_JUDGE_MODEL = 'gpt-5-mini';
const hallucinationMetric = new Hallucination({ model: LLM_AS_A_JUDGE_MODEL });
const answerRelevanceMetric = new AnswerRelevance({ model: LLM_AS_A_JUDGE_MODEL });
const usefulnessMetric = new Usefulness({ model: LLM_AS_A_JUDGE_MODEL });

const agentConfigs: Record<string, AgentConfig> = {
  'user-skill-agent': {
    name: 'user-skill-agent',
    datasetFile: 'user-skill-agent.json',
    datasetName: 'user-skill-agent-evaluation',
    task: userSkillAgentTask as unknown as EvaluationTask<DatasetItem>,
    metrics: [hallucinationMetric, answerRelevanceMetric, usefulnessMetric],
    seedData: (items) => seedUserSkillAgentData(items as unknown as UserSkillDatasetItem[])
  },
  'skill-resource-retriever': {
    name: 'skill-resource-retriever-agent',
    datasetFile: 'skill-resource-retriever-agent.json',
    datasetName: 'skill-resource-retriever-evaluation',
    task: skillResourceRetrieverTask as unknown as EvaluationTask<DatasetItem>,
    metrics: [hallucinationMetric, answerRelevanceMetric, usefulnessMetric],
    seedData: (items) => seedSkillResourceRetrieverData(items as unknown as SkillResourceDatasetItem[])
  },
  'challenge-generator': {
    name: 'challenge-generator-agent',
    datasetFile: 'challenge-generator-agent.json',
    datasetName: 'challenge-generator-evaluation',
    task: challengeGeneratorAgentTask as unknown as EvaluationTask<DatasetItem>,
    metrics: [hallucinationMetric, answerRelevanceMetric, usefulnessMetric],
    seedData: (items) => seedChallengeGeneratorData(items as unknown as ChallengeGeneratorDatasetItem[])
  }
};

// Run evaluation for a single agent using Opik's evaluate function
async function runAgentEvaluation(
  agentKey: string,
  options: { samples?: number; verbose?: boolean; source?: DatasetSource }
): Promise<{
  agentName: string;
  experimentId: string;
  experimentName: string;
  testResultsCount: number;
}> {
  const config = agentConfigs[agentKey];
  if (!config) {
    throw new Error(`Unknown agent: ${agentKey}`);
  }

  const source = options.source || 'local';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Evaluating: ${config.name}`);
  console.log(`Dataset source: ${source}`);
  console.log(`${'='.repeat(60)}`);

  const client = new Opik({ projectName: process.env.OPIK_PROJECT_NAME });

  // Get or create the dataset in Opik
  const dataset = await client.getOrCreateDataset<DatasetItem>(config.datasetName);

  let datasetItems: DatasetItem[];

  if (source === 'local') {
    // Load from local JSON file
    console.log('Loading from local JSON file...');
    const localItems = loadDatasetItems(config.datasetFile);

    // Transform items to use proper UUIDs and mark as local source
    datasetItems = localItems.map((item) => ({
      ...item,
      originalId: item.id, // Keep original ID for reference
      id: generateId(), // Generate proper UUID
      dataSource: 'local' // Mark as local source for filtering (avoid 'source' - reserved by Opik)
    }));

    console.log(`Loaded ${datasetItems.length} local items`);
  } else {
    // Load from Opik platform (includes all items: local and remote-only)
    console.log('Loading from Opik platform...');
    datasetItems = await dataset.getItems();
    console.log(`Found ${datasetItems.length} items in Opik dataset`);

    if (datasetItems.length === 0) {
      throw new Error(`No items found in Opik dataset "${config.datasetName}". Create items in Opik UI or use --source local.`);
    }
  }

  // Apply samples limit if specified
  if (options.samples && options.samples < datasetItems.length) {
    datasetItems = datasetItems.slice(0, options.samples);
  }

  console.log(`Dataset items to evaluate: ${datasetItems.length}`);

  // Seed the database with test data (this mutates datasetItems with fresh UUIDs)
  console.log('Seeding database...');
  await config.seedData(datasetItems);
  console.log('Database seeded successfully');

  // Update Opik dataset with mutated items (after seeding, so IDs match the database)
  // This is needed for both sources because seeding mutates the items with fresh UUIDs
  if (source === 'local') {
    await dataset.clear();
    await dataset.insert(datasetItems);
    console.log('Inserted seeded items to Opik');
  } else {
    // For opik source, update existing items with mutated IDs
    await dataset.update(datasetItems);
    console.log('Updated Opik items with seeded IDs');
  }

  // Create experiment name with timestamp
  const experimentName = `${config.name}-eval-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`;

  console.log(`Experiment: ${experimentName}\n`);

  if (options.verbose) {
    console.log('Running evaluation with Opik evaluate()...');
  }

  // Run the evaluation using Opik's evaluate function
  // Items were inserted to Opik after seeding, so dataset now has the correct mutated IDs
  const result = await evaluate<DatasetItem>({
    dataset,
    task: config.task,
    scoringMetrics: config.metrics,
    experimentName,
    nbSamples: options.samples
  });

  // Print summary
  console.log(`\n${'-'.repeat(40)}`);
  console.log('Summary:');
  console.log(`  Experiment ID: ${result.experimentId}`);
  console.log(`  Experiment Name: ${result.experimentName}`);
  console.log(`  Total test cases: ${result.testResults.length}`);

  if (options.verbose && result.testResults.length > 0) {
    console.log('\nDetailed Results:');
    for (const testResult of result.testResults) {
      console.log(`\n  Test case:`);
      for (const scoreResult of testResult.scoreResults) {
        const scoreStr = (scoreResult.value * 100).toFixed(1) + '%';
        console.log(`    ${scoreResult.name}: ${scoreStr}${scoreResult.reason ? ` - ${scoreResult.reason}` : ''}`);
      }
    }
  }

  // Calculate and print average scores by metric
  const metricTotals: Record<string, { total: number; count: number }> = {};
  for (const testResult of result.testResults) {
    for (const scoreResult of testResult.scoreResults) {
      if (!metricTotals[scoreResult.name]) {
        metricTotals[scoreResult.name] = { total: 0, count: 0 };
      }
      metricTotals[scoreResult.name].total += scoreResult.value;
      metricTotals[scoreResult.name].count += 1;
    }
  }

  console.log('\nAverage Scores:');
  for (const [metricName, { total, count }] of Object.entries(metricTotals)) {
    const avg = total / count;
    console.log(`  ${metricName}: ${(avg * 100).toFixed(1)}%`);
  }

  return {
    agentName: config.name,
    experimentId: result.experimentId || 'unknown',
    experimentName: result.experimentName || experimentName,
    testResultsCount: result.testResults.length
  };
}

// Main function
async function main() {
  const args = parseArgs();

  if (!args.agent && !args.all) {
    console.error('Error: Please specify --agent <name> or --all');
    console.log('Run with --help for usage information');
    process.exit(1);
  }

  const startTime = Date.now();
  const allResults: { agentName: string; experimentId: string; experimentName: string; testResultsCount: number }[] = [];

  if (args.all) {
    // Run all agents
    for (const agentKey of Object.keys(agentConfigs)) {
      try {
        const result = await runAgentEvaluation(agentKey, {
          samples: args.samples,
          verbose: args.verbose,
          source: args.source
        });
        allResults.push(result);
      } catch (error) {
        console.error(`Failed to evaluate ${agentKey}:`, error);
      }
    }
  } else if (args.agent) {
    // Handle skill-resource as alias for both retriever and evaluator
    const agentsToRun = args.agent === 'skill-resource' ? ['skill-resource-retriever', 'skill-resource-evaluator'] : [args.agent];

    for (const agentKey of agentsToRun) {
      try {
        const result = await runAgentEvaluation(agentKey, {
          samples: args.samples,
          verbose: args.verbose,
          source: args.source
        });
        allResults.push(result);
      } catch (error) {
        console.error(`Failed to evaluate ${agentKey}:`, error);
        if (agentsToRun.length === 1) {
          process.exit(1);
        }
      }
    }
  }

  // Print final summary
  const totalTime = Date.now() - startTime;
  console.log(`\n${'='.repeat(60)}`);
  console.log('EVALUATION COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`\nResults by agent:`);

  for (const result of allResults) {
    console.log(`\n  ${result.agentName}:`);
    console.log(`    Experiment ID: ${result.experimentId}`);
    console.log(`    Experiment Name: ${result.experimentName}`);
    console.log(`    Test Cases: ${result.testResultsCount}`);
  }

  console.log(`\nView detailed results in Opik dashboard`);
}

main().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
