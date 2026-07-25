import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";

export const TopicSummarySchema = z.object({
  name: z.string(),
  itemCount: z.number(),
  updatedAt: z.string(),
});
export type TopicSummary = z.output<typeof TopicSummarySchema>;

export const ItemSummarySchema = z.object({
  topicName: z.string(),
  name: z.string(),
  size: z.number(),
  updatedAt: z.string(),
});
export type ItemSummary = z.output<typeof ItemSummarySchema>;

export const ItemSchema = ItemSummarySchema.extend({
  content: z.string(),
});
export type Item = z.output<typeof ItemSchema>;

export const ResearchAgentConfigSchema = z
  .object({
    researchDirectory: z.string().exactOptional(),
  })
  .prefault({});

export type ResearchAgentConfig = z.output<typeof ResearchAgentConfigSchema>;

export const ResearchServiceConfigSchema = z
  .object({
    agentDefaults: z
      .object({
        researchDirectory: z.string().meta({ description: "Directory where research topics are stored" } satisfies ConfigFieldMeta),
      })
      .meta({ label: "Agent Defaults" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Research", description: "Topic-based research dossiers, backed by markdown files on disk" } satisfies ConfigFieldMeta);

export type ResearchServiceConfig = z.input<typeof ResearchServiceConfigSchema>;
export type ParsedResearchConfig = z.output<typeof ResearchServiceConfigSchema>;
