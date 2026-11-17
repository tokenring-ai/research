import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";
import { MAX_SOURCES, SourceInputSchema } from "../sources.ts";

const name = "item_write";
const displayName = "Research/write item";

async function execute({ topicName, name: itemName, content, sources }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireService(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const item = await researchService.updateItem(directory, topicName, itemName, content, sources ? { sources } : {});

  return {
    message: `**Research** Saved "${topicName}/${itemName}"`,
    result: JSON.stringify({ topicName: item.topicName, name: item.name, size: item.size, sourceCount: item.sourceCount, updatedAt: item.updatedAt }),
  };
}

const description =
  "Create or overwrite a research item (a single markdown file) within a topic. The topic is created automatically if it doesn't already exist. Use this to save research notes, summaries, and deep-dives so they can be referenced later or viewed by the user. When the item is based on web material, pass every URL you actually read in `sources`; they are stored as structured references and listed in the exported brief.";

const inputSchema = z.object({
  topicName: z.string().describe("Name of the topic this item belongs to; created automatically if it doesn't exist"),
  name: z.string().describe("Name of the item to create or update"),
  content: z.string().describe("Full markdown content of the research item (without frontmatter; sources go in `sources`)"),
  sources: z
    .array(SourceInputSchema)
    .max(MAX_SOURCES)
    .exactOptional()
    .describe("Structured sources for this item, replacing any recorded earlier. Omit to keep the existing sources; pass [] to clear them."),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
