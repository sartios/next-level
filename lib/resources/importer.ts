import * as fs from 'fs';
import * as path from 'path';
import {
  ImportFileSchema,
  type ImportFile,
  type ImportResource,
  type ImportResult,
  type ImportResourceResult,
  type ImportOptions
} from './types';
import { createEmbeddings } from '../embeddings';
import type { NewLearningResource, NewResourceEmbedding, LearningResourceSection } from '../types';
import { insertResourceEmbeddings } from '../db/embeddingRepository';
import { getLearningResourceByUrl, insertLearningResource, insertResourceSections, linkSkillToResource } from '../db/resourceRepository';
import { upsertSkill } from '../db/skillRepository';

/**
 * Prepare full resource text for embedding (combines all content)
 */
function prepareFullResourceText(resource: ImportResource): string {
  const parts: string[] = [];

  parts.push(`Title: ${resource.title}`);
  parts.push(`Provider: ${resource.provider} | Type: ${resource.resourceType}`);

  if (resource.description) {
    parts.push(`\nDescription: ${resource.description}`);
  }

  if (resource.learningObjectives && resource.learningObjectives.length > 0) {
    parts.push(`\nWhat You'll Learn:`);
    resource.learningObjectives.forEach((item) => {
      parts.push(`- ${item}`);
    });
  }

  if (resource.targetAudience && resource.targetAudience.length > 0) {
    parts.push(`\nTarget Audience:`);
    resource.targetAudience.forEach((audience) => {
      parts.push(`- ${audience}`);
    });
  }

  if (resource.sections && resource.sections.length > 0) {
    parts.push(`\nSections:`);
    resource.sections.forEach((section) => {
      const minutes = section.estimatedMinutes ? ` (${section.estimatedMinutes} minutes)` : '';
      parts.push(`- ${section.title}${minutes}`);
      // Include topics under each section for richer embedding
      if (section.topics && section.topics.length > 0) {
        section.topics.forEach((topic) => {
          parts.push(`  • ${topic}`);
        });
      }
    });
  }

  return parts.join('\n');
}

/**
 * Represents an item to be embedded
 */
interface EmbeddingItem {
  contentType: 'resource' | 'description' | 'learning_objective' | 'target_audience' | 'section';
  contentIndex: number | null;
  sectionId: string | null;
  contentText: string;
}

/**
 * Prepare all embedding items for a resource
 */
function prepareEmbeddingItems(resource: ImportResource, insertedSections: LearningResourceSection[]): EmbeddingItem[] {
  const items: EmbeddingItem[] = [];

  // Full resource embedding
  items.push({
    contentType: 'resource',
    contentIndex: null,
    sectionId: null,
    contentText: prepareFullResourceText(resource)
  });

  // Description embedding (if present)
  if (resource.description) {
    items.push({
      contentType: 'description',
      contentIndex: null,
      sectionId: null,
      contentText: resource.description
    });
  }

  // Learning objectives embeddings
  if (resource.learningObjectives && resource.learningObjectives.length > 0) {
    resource.learningObjectives.forEach((objective, index) => {
      items.push({
        contentType: 'learning_objective',
        contentIndex: index,
        sectionId: null,
        contentText: objective
      });
    });
  }

  // Target audience embeddings
  if (resource.targetAudience && resource.targetAudience.length > 0) {
    resource.targetAudience.forEach((audience, index) => {
      items.push({
        contentType: 'target_audience',
        contentIndex: index,
        sectionId: null,
        contentText: audience
      });
    });
  }

  // Section embeddings (include topics in the content text for better semantic search)
  if (insertedSections.length > 0) {
    insertedSections.forEach((section, index) => {
      // Combine section title with topics for richer embedding
      const topicsText = section.topics && section.topics.length > 0 ? `\nTopics: ${section.topics.join(', ')}` : '';
      items.push({
        contentType: 'section',
        contentIndex: index,
        sectionId: section.id,
        contentText: `${section.title}${topicsText}`
      });
    });
  }

  return items;
}

/**
 * Generate and store embeddings for all content types
 */
async function generateAndStoreEmbeddings(resourceId: string, items: EmbeddingItem[]): Promise<void> {
  if (items.length === 0) return;

  // Extract texts for batch embedding
  const texts = items.map((item) => item.contentText);

  // Generate embeddings in batch
  const embeddings = await createEmbeddings(texts);

  // Prepare embedding records
  const embeddingRecords: NewResourceEmbedding[] = items.map((item, index) => ({
    resourceId,
    contentType: item.contentType,
    contentIndex: item.contentIndex,
    sectionId: item.sectionId,
    contentText: item.contentText,
    embedding: embeddings[index]
  }));

  // Insert all embeddings
  await insertResourceEmbeddings(embeddingRecords);
}

/**
 * Import a single resource
 */
async function importSingleResource(resource: ImportResource, career: string, options: ImportOptions): Promise<ImportResourceResult> {
  try {
    // Check if resource already exists
    const existing = await getLearningResourceByUrl(resource.url);
    if (existing) {
      return {
        url: resource.url,
        title: resource.title,
        success: true,
        resourceId: existing.id,
        error: 'Resource already exists (skipped)'
      };
    }

    if (options.dryRun) {
      return {
        url: resource.url,
        title: resource.title,
        success: true,
        error: 'Dry run - would be inserted'
      };
    }

    // Upsert the skill
    const skill = await upsertSkill(resource.skill, career);

    // Prepare learning resource data
    const learningResourceData: NewLearningResource = {
      url: resource.url,
      title: resource.title,
      description: resource.description ?? null,
      provider: resource.provider,
      resourceType: resource.resourceType,
      learningObjectives: resource.learningObjectives ?? [],
      targetAudience: resource.targetAudience ?? [],
      totalHours: resource.totalHours ?? null
    };

    // Insert the learning resource
    const insertedResource = await insertLearningResource(learningResourceData);

    // Insert sections if provided
    let insertedSections: LearningResourceSection[] = [];
    if (resource.sections && resource.sections.length > 0) {
      insertedSections = await insertResourceSections(insertedResource.id, resource.sections);
    }

    // Link skill to resource
    await linkSkillToResource(skill.id, insertedResource.id, resource.level);

    // Generate and store embeddings for all content types
    const embeddingItems = prepareEmbeddingItems(resource, insertedSections);
    await generateAndStoreEmbeddings(insertedResource.id, embeddingItems);

    return {
      url: resource.url,
      title: resource.title,
      success: true,
      resourceId: insertedResource.id,
      skillId: skill.id
    };
  } catch (error) {
    return {
      url: resource.url,
      title: resource.title,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Directory where resource JSON files are stored (lib/resources/data/)
 */
const DATA_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'data');

function resolveFilePath(filePath: string): string {
  return path.join(DATA_DIR, filePath);
}

/**
 * Parse and validate a JSON import file
 */
export function parseImportFile(filePath: string): ImportFile {
  const absolutePath = resolveFilePath(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON in file: ${filePath} - err: ${e}`);
  }

  const result = ImportFileSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Import resources from a JSON file
 */
export async function importResourcesFromJson(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
  const importData = parseImportFile(filePath);
  const results: ImportResourceResult[] = [];

  console.log(`\nImporting ${importData.resources.length} resources for career: ${importData.career}`);
  if (options.dryRun) {
    console.log('(Dry run mode - no changes will be made)\n');
  } else {
    console.log('');
  }

  for (let i = 0; i < importData.resources.length; i++) {
    const resource = importData.resources[i];
    console.log(`[${i + 1}/${importData.resources.length}] ${resource.title}...`);

    const result = await importSingleResource(resource, importData.career, options);

    results.push(result);

    if (result.success) {
      if (result.error) {
        console.log(`  ⚠ ${result.error}`);
      } else {
        console.log(`  ✓ Imported successfully`);
      }
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
    }
  }

  const successCount = results.filter((r) => r.success && !r.error?.includes('skipped')).length;
  const skippedCount = results.filter((r) => r.error?.includes('skipped')).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(`\n--- Import Summary ---`);
  console.log(`Career: ${importData.career}`);
  console.log(`Total resources: ${importData.resources.length}`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Skipped (already exist): ${skippedCount}`);
  console.log(`Failed: ${failureCount}`);

  return {
    career: importData.career,
    totalResources: importData.resources.length,
    successCount,
    failureCount,
    results
  };
}

/**
 * Validate a JSON file without importing
 */
export function validateImportFile(filePath: string): {
  valid: boolean;
  data?: ImportFile;
  error?: string;
} {
  try {
    const data = parseImportFile(filePath);
    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get all JSON files from the data directory
 */
export function getDataFiles(): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
}

/**
 * Import all resources from all JSON files in the data directory
 */
export async function importAllResources(options: ImportOptions = {}): Promise<{
  totalFiles: number;
  results: Array<{ file: string; result: ImportResult | { error: string } }>;
}> {
  const files = getDataFiles();

  if (files.length === 0) {
    console.log('No JSON files found in data directory');
    return { totalFiles: 0, results: [] };
  }

  console.log(`Found ${files.length} resource file(s) to process\n`);
  console.log('='.repeat(60));

  const results: Array<{ file: string; result: ImportResult | { error: string } }> = [];

  for (const file of files) {
    console.log(`\nProcessing: ${file}`);
    console.log('-'.repeat(40));

    try {
      const result = await importResourcesFromJson(file, options);
      results.push({ file, result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`✗ Error processing ${file}: ${errorMessage}`);
      results.push({ file, result: { error: errorMessage } });
    }
  }

  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));

  let totalResources = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const { file, result } of results) {
    if ('error' in result) {
      console.log(`\n${file}: ERROR - ${result.error}`);
    } else {
      totalResources += result.totalResources;
      totalSuccess += result.successCount;
      totalSkipped += result.results.filter((r) => r.error?.includes('skipped')).length;
      totalFailed += result.failureCount;
      console.log(
        `\n${file}: ${result.successCount} imported, ${result.results.filter((r) => r.error?.includes('skipped')).length} skipped, ${result.failureCount} failed`
      );
    }
  }

  console.log('\n--- Overall Summary ---');
  console.log(`Total files processed: ${files.length}`);
  console.log(`Total resources: ${totalResources}`);
  console.log(`Successfully imported: ${totalSuccess}`);
  console.log(`Skipped (already exist): ${totalSkipped}`);
  console.log(`Failed: ${totalFailed}`);

  return { totalFiles: files.length, results };
}
