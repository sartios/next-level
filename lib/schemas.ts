import { z } from 'zod';

export const ResourceSchema = z.object({
  title: z.string().describe('The title of the resource'),
  link: z.string().describe('The link of the resource'),
  reasoning: z.string().describe('The reason of resource relevance to the skill'),
  provider: z.string().describe('The provider of the resource'),
  approximateHours: z.number().describe('The approximate hours for completing the resource'),
  relevancePercentage: z.number().describe('The relevance percentage of the resource to the goal'),
  sections: z.array(
    z.object({
      skill: z.string().describe('The skill of section focus'),
      location: z.string().describe('The specific place of the section within the resource')
    })
  )
});
