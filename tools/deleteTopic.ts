import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ApprovalLevel } from "@tokenring-ai/chat/schema";
import { requireToolApproval } from "@tokenring-ai/chat/util/requireToolApproval";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "topic_delete";
const displayName = "Research/delete topic";

async function execute({ name: topicName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  await requireToolApproval(agent, {
    toolName: name,
    message: `Delete the research topic "${topicName}" and all its items?`,
    detailedDescription: `Permanently deletes the research topic "${topicName}" and every item in it.`,
    safetyLevel: ApprovalLevel.OwnDataLoss,
    default: false,
  });
  const researchService = agent.requireService(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const success = await researchService.deleteTopic(directory, topicName);

  return {
    message: success ? `**Research** Deleted topic "${topicName}"` : `**Research** Topic "${topicName}" not found`,
    result: JSON.stringify({ success }),
  };
}

const description = "Delete a research topic and all of the markdown items it contains";

const inputSchema = z.object({
  name: z.string().describe("Name of the topic to delete"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
