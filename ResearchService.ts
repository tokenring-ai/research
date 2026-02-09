import {Agent} from "@tokenring-ai/agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {TokenRingService} from "@tokenring-ai/app/types";
import {outputChatAnalytics} from "@tokenring-ai/chat/util/outputChatAnalytics";
import {z} from "zod";

export const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
});

const name = "research_run";

export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;

/**
 * The actual implementation of GhostIOService
 */
export default class ResearchService implements TokenRingService {
  readonly name = "ResearchService";
  description = "Provides Research functionality";

  constructor(private options: ResearchServiceConfig) {
  }

  async runResearch(topic: string, prompt: string, agent: Agent): Promise<string> {
    const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);

    // Get Gemini client from model registry
    const aiChatClient = await chatModelRegistry.getClient(this.options.researchModel);


    agent.infoMessage(`[Research] Dispatching research request for "${topic}" to ${aiChatClient.getModelId()}`);

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

    agent.infoMessage(`[${name}] Successfully generated research for "${topic}"`);
    agent.artifactOutput({
      name: `Research on ${topic}`,
      encoding: 'text',
      mimeType: 'text/markdown',
      body: `Topic: ${topic}\nPrompt: ${prompt}\n\nResult: ${research}`
    });

    outputChatAnalytics(response, agent, name);

    return research;
  }
}