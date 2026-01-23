import { z } from 'zod';

export function validateJson(schema: z.ZodTypeAny, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error('Invalid JSON output: ' + JSON.stringify(result.error.format()));
  }

  return result.data;
}
