import { Opik, evaluate, type EvaluationTask, type BaseMetric, generateId, Hallucination, AnswerRelevance, Usefulness } from 'opik';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { skillResourceRetrieverTask } from './tasks/skillResourceRetrieverTask.js';

import { StructuredOutputMetric, RAGRetrievalMetric, ResponseTimeMetric } from './metrics/index.js';

// Dataset item type compatible with Opik's DatasetItemData
type DatasetItem = {
  [key: string]: unknown;
  id: string;
  name: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI argument parsing
interface CliArgs {
  agent?: string;
  all?: boolean;
  samples?: number;
  verbose?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
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
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Opik Evaluation Runner

Usage:
  npx tsx evals/run.ts [options]

Options:
  --agent <name>   Run evaluation for a specific agent
  --all            Run all evaluations
  --samples <n>    Limit the number of samples to evaluate
  --verbose        Show detailed output
  --help, -h       Show this help message

Examples:
  npx tsx evals/run.ts --agent skill-resource-retriever
  npx tsx evals/run.ts --agent skill-resource-retriever --verbose
  npx tsx evals/run.ts --all --samples 2
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
}

// Initialize built-in metrics
const LLM_AS_A_JUDGE_MODEL = 'gpt-5-mini';
const hallucinationMetric = new Hallucination({ model: LLM_AS_A_JUDGE_MODEL });
const answerRelevanceMetric = new AnswerRelevance({ model: LLM_AS_A_JUDGE_MODEL });
const usefulnessMetric = new Usefulness({ model: LLM_AS_A_JUDGE_MODEL });

const agentConfigs: Record<string, AgentConfig> = {
  'skill-resource-retriever': {
    name: 'skill-resource-agent-retriever',
    datasetFile: 'skill-resource-retriever-agent.json',
    datasetName: 'skill-resource-retriever-evaluation',
    task: skillResourceRetrieverTask as unknown as EvaluationTask<DatasetItem>,
    metrics: [
      hallucinationMetric,
      answerRelevanceMetric,
      usefulnessMetric,
      new RAGRetrievalMetric(),
      new StructuredOutputMetric(),
      new ResponseTimeMetric()
    ]
  }
};

// Run evaluation for a single agent using Opik's evaluate function
async function runAgentEvaluation(
  agentKey: string,
  options: { samples?: number; verbose?: boolean }
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

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Evaluating: ${config.name}`);
  console.log(`${'='.repeat(60)}`);

  const client = new Opik({ projectName: process.env.OPIK_PROJECT_NAME });

  // Load dataset items from JSON file
  let datasetItems = loadDatasetItems(config.datasetFile);
  if (options.samples && options.samples < datasetItems.length) {
    datasetItems = datasetItems.slice(0, options.samples);
  }

  console.log(`Dataset items: ${datasetItems.length}`);

  // Get or create the dataset in Opik
  const dataset = await client.getOrCreateDataset<DatasetItem>(config.datasetName);

  // Transform items to use proper UUIDs (Opik requires UUID format for IDs)
  const itemsWithUuids = datasetItems.map((item) => ({
    ...item,
    originalId: item.id, // Keep original ID for reference
    id: generateId() // Generate proper UUID
  }));

  // Insert items into the dataset
  await dataset.insert(itemsWithUuids);

  // Create experiment name with timestamp
  const experimentName = `${config.name}-eval-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`;

  console.log(`Experiment: ${experimentName}\n`);

  if (options.verbose) {
    console.log('Running evaluation with Opik evaluate()...');
  }

  // Run the evaluation using Opik's evaluate function
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
          verbose: args.verbose
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
          verbose: args.verbose
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
