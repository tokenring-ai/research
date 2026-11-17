import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";
import { MAX_TAG_LENGTH, MAX_TAGS } from "../tags.ts";

const name = "topic_setTags";
const displayName = "Research/set topic tags";

async function execute({ topicName, tags }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireService(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const topic = await researchService.setTopicTags(directory, topicName, tags);

  return {
    message: topic.tags.length ? `**Research** Tagged "${topicName}": ${topic.tags.join(", ")}` : `**Research** Cleared tags on "${topicName}"`,
    result: JSON.stringify({ topicName, tags: topic.tags }),
  };
}

const description =
  "Set the tags of a research topic, replacing its existing tags. Use it to record the client or project a topic belongs to (for example 'acme') so the user can filter topics by it. Tags are trimmed, lowercased and de-duplicated; pass an empty list to clear them.";

const inputSchema = z.object({
  topicName: z.string().describe("Name of the existing topic to tag"),
  tags: z.array(z.string()).max(50).describe(`Complete list of tags (at most ${MAX_TAGS} are kept, each up to ${MAX_TAG_LENGTH} characters)`),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
