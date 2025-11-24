import {Agent} from "@tokenring-ai/agent";
import {ModelRegistry} from "@tokenring-ai/ai-client";
import {TokenRingService} from "@tokenring-ai/app/types";
import {z} from "zod";
import {name} from "./tools/research.js";
import { outputChatAnalytics } from "@tokenring-ai/chat/util/outputChatAnalytics";

export const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
});

export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;

/**
 * The actual implementation of GhostIOService
 */
export default class ResearchService implements TokenRingService {
  name = "ResearchService";
  description = "Provides Research functionality";
  researchModel: string;

  constructor({ researchModel }: ResearchServiceConfig) {
    this.researchModel = researchModel;
  }

  async runResearch(topic: string, prompt: string, agent: Agent): Promise<string> {
    const modelRegistry = agent.requireServiceByType(ModelRegistry);

    // Get Gemini client from model registry
    const aiChatClient = await modelRegistry.chat.getFirstOnlineClient(this.researchModel);


    agent.systemMessage(`[Research] Dispatching research request for "${topic}" to ${aiChatClient.getModelId()}`);

    // Generate research using Gemini
    const [research, response] = await aiChatClient.textChat(
      {
        tools: {},
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant, tasked with researching a topic for the user, using web search. " +
              "The users is going to ask you a question, and you will research that using the web search tool, and return detailed and comprehensive research on the topic.",
          },
          {
            role: "user",
            content: `Research the following topic: ${topic}, focusing on the following question: ${prompt}`,
          },
        ],
      },
      agent,
    );

    agent.systemMessage(`[${name}] Successfully generated research for "${topic}"`);
    agent.chatOutput(`Research: \n${research}"`);

    outputChatAnalytics(response, agent, name);

    return research;
  }
}