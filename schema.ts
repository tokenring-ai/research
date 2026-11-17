import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";
import { SourceSchema } from "./sources.ts";

export const TopicSummarySchema = z.object({
  name: z.string(),
  itemCount: z.number(),
  updatedAt: z.string(),
  /** Normalised client / project tags from the topic's `.topic.yaml`; empty when untagged. */
  tags: z.array(z.string()),
});
export type TopicSummary = z.output<typeof TopicSummarySchema>;

export const ItemSummarySchema = z.object({
  topicName: z.string(),
  name: z.string(),
  size: z.number(),
  updatedAt: z.string(),
  /** Number of structured sources recorded in the item's frontmatter. */
  sourceCount: z.number(),
});
export type ItemSummary = z.output<typeof ItemSummarySchema>;

export const ItemSchema = ItemSummarySchema.extend({
  /** The Markdown without its frontmatter block. */
  content: z.string(),
  sources: z.array(SourceSchema),
  /** Set when the file's frontmatter was unusable; `content` is then the raw file text. */
  warning: z.string().exactOptional(),
});
export type Item = z.output<typeof ItemSchema>;

/** One dossier matching a cross-topic search. */
export const ItemSearchResultSchema = z.object({
  topicName: z.string(),
  name: z.string(),
  /** The dossier's first Markdown heading, or null when it has none. */
  title: z.string().nullable(),
  /** True when the query matched the dossier name or its title heading. */
  titleMatch: z.boolean(),
  /** Number of case-insensitive occurrences in the content. */
  contentMatches: z.number(),
  /** Context around the first content match (or the start of the dossier for a title-only match). */
  snippet: z.string(),
  updatedAt: z.string(),
});
export type ItemSearchResult = z.output<typeof ItemSearchResultSchema>;

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
        researchDirectory: z
          .string()
          .default("research")
          .meta({ description: "Directory where research topics are stored" } satisfies ConfigFieldMeta),
      })
      .prefault({})
      .meta({ label: "Agent Defaults" } satisfies ConfigFieldMeta),
    agentTypes: z
      .array(z.string())
      .default(["research"])
      .meta({ description: "The available agent types that can be used for research" } satisfies ConfigFieldMeta),
  })
  .prefault({})
  .meta({ label: "Research", description: "Topic-based research dossiers, backed by markdown files on disk" } satisfies ConfigFieldMeta);

export type ResearchServiceConfig = z.input<typeof ResearchServiceConfigSchema>;
export type ParsedResearchConfig = z.output<typeof ResearchServiceConfigSchema>;
