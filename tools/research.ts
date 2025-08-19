import {ModelRegistry} from "@token-ring/ai-client";
import {outputChatAnalytics} from "@token-ring/ai-client/util/outputChatAnalytics";
import {ChatService} from "@token-ring/chat";
import {Registry} from "@token-ring/registry";
import {z} from "zod";

export interface ResearchArgs {
  topic?: string;
  prompt?: string;
}

export interface ResearchSuccessResult {
  status: "completed";
  topic: string;
  research: string;
  message: string;
}

export interface ResearchErrorResult {
  status: "error";
  topic: string;
  error: string;
  message: string;
}

export type ResearchResult = ResearchSuccessResult | ResearchErrorResult;

export const name = "research/run";

/**
 * Dispatches a research request to Gemini and returns the generated research
 * @param args
 * @param registry - The package registry
 * @returns Result containing the generated research
 */
export async function execute(
  {topic, prompt}: ResearchArgs,
  registry: Registry,
): Promise<ResearchResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const modelRegistry = registry.requireFirstServiceByType(ModelRegistry);

  if (!topic) {
    throw new Error(`[${name}] Error: Topic is required`);
  }

  if (!prompt) {
    throw new Error(`[${name}] Error: Prompt is required`);
  }


  chatService.systemLine(`[Research] Dispatching research request for "${topic}" to Gemini`);

  // Get Gemini client from model registry
  const geminiClient = await modelRegistry.chat.getFirstOnlineClient(
    "gemini-2.5-flash-web-search",
  );

  // Generate research using Gemini
  const [research, response] = await geminiClient.textChat(
    {
      tools: {},
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant, tasked with researching a topic for the user, using web search. " +
            "The users is going to ask you a question, and you will research that using the wbe search tool, and return detailed and comprehensive research on the topic.",
        },
        {
          role: "user",
          content: `Research the following topic: ${topic}, focusing on the following question: ${prompt}`,
        },
      ],
    },
    registry,
  );

  chatService.systemLine(`[${name}] Successfully generated research for "${topic}"`);
  chatService.out(`Research: \n${research}"`);

  outputChatAnalytics(response, chatService, name);

  return {
    status: "completed",
    topic,
    research,
    message: `Research completed successfully for topic: ${topic}`,
  };

}

export const description =
  "Dispatches a research request to an AI agent, and returns the generated research content.";

export const inputSchema = z.object({
  topic: z.string().describe("The main topic or subject to research"),
  prompt: z
    .string()
    .describe(
      "The detailed research prompt or specific questions to investigate about the topic",
    ),
});
