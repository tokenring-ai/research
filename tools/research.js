import { ChatService } from "@token-ring/chat";
import { ModelRegistry } from "@token-ring/ai-client";
import { z } from "zod";

/**
 * Dispatches a research request to Gemini and returns the generated research
 * @param {object} args
 * @param {string} args.topic - The topic to research
 * @param {string} args.prompt - The research prompt or question
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result containing the generated research
 */
export async function execute({ topic, prompt }, registry) {
	const chatService = registry.requireFirstServiceByType(ChatService);
	const modelRegistry = registry.requireFirstServiceByType(ModelRegistry);

	chatService.systemLine(
		`[Research] Dispatching research request for "${topic}" to Gemini`,
	);

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
							"You are a research assistant, tasked with researching a topic for the user, using your own knowledge, as well as web search. " +
							"The users is going to ask you a question, and you will return detailed and comprehensive research on the topic.",
					},
					{
						role: "user",
						content: `Research the following topic: ${topic}, focusing on the following question: ${prompt}`,
					},
				],
			},
			registry,
		);

		chatService.systemLine(
			`[Research] Successfully generated research for "${topic}". Research: \n${research}\n"`,
		);

		// Crop token cost to 4 decimal places if present
		if (response.usage) {
			const { promptTokens, completionTokens, cost } = response.usage;

			chatService.systemLine(
				`[Research] Successfully generated research for "${topic}". Research: \n${research}\n"`,
			);
			chatService.systemLine(
				`[Research] Token usage - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}, cost: ${cost}`,
			);
		}
		return {
			status: "completed",
			topic,
			research: research,
			message: `Research completed successfully for topic: ${topic}`,
		};
	} catch (error) {
		chatService.systemLine(
			`[Research] Error generating research: ${error.message}`,
		);

		return {
			status: "error",
			topic,
			error: error.message,
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
