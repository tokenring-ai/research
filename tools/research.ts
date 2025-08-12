import { ModelRegistry } from "@token-ring/ai-client";
import { ChatService } from "@token-ring/chat";
import { Registry } from "@token-ring/registry";
import { z } from "zod";

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

/**
 * Dispatches a research request to Gemini and returns the generated research
 * @param args
 * @param registry - The package registry
 * @returns Result containing the generated research
 */
export async function execute(
  { topic, prompt }: ResearchArgs,
  registry: Registry,
): Promise<ResearchResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const modelRegistry = registry.requireFirstServiceByType(ModelRegistry);

  if (! topic) {
      chatService.systemLine(`\[Research] Error: Topic is required`);
      return {
          status: "error",
          topic: "",
          error: "Topic is required",
          message: `Failed to generate research, topic is required`,
      };
  }

  if (! prompt) {
      chatService.systemLine(`\[Research] Error: Prompt is required`);
      return {
          status: "error",
          topic: "",
          error: "Prompt is required",
          message: `Failed to generate research, prompt is required`,
      };
  }


  chatService.systemLine(`\[Research] Dispatching research request for "${topic}" to Gemini`);

  try {
    // Get Gemini client from model registry
    const geminiClient = await modelRegistry.chat.getFirstOnlineClient(
      "gemini-2.5-flash-web-search",
    );

    // Generate research using Gemini
    const [research, response] = await geminiClient.textChat(
      {
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

    chatService.systemLine(`\[Research] Successfully generated research for "${topic}"`);
    chatService.out(`Research: \n${research}"`);

    // Show token usage if present
    const usage: any = response.usage;
    if (usage) {
      const { promptTokens, completionTokens, cost } = usage;
      chatService.systemLine(
        `\[Research] Token usage - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}, cost: ${cost}`,
      );
    }

    return {
      status: "completed",
      topic,
      research,
      message: `Research completed successfully for topic: ${topic}`,
    };
  } catch (error: any) {
    chatService.systemLine(`\[Research] Error generating research: ${error?.message}`);

    return {
      status: "error",
      topic,
      error: error?.message,
      message: `Failed to generate research for topic: ${topic}`,
    };
  }
}

export const description =
  "Dispatches a research request to an AI agent, and returns the generated research content.";

export const parameters = z.object({
  topic: z.string().describe("The main topic or subject to research"),
  prompt: z
    .string()
    .describe(
      "The detailed research prompt or specific questions to investigate about the topic",
    ),
});
