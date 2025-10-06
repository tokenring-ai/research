# @token-ring/research

Research tooling for the Token Ring ecosystem. This package exposes a ready-to-use research tool that dispatches a
web-enabled AI model request (Gemini 2.5 Flash Web Search) to generate research on a given topic and prompt. It
integrates with the Token Ring Registry, Chat, and AI Client packages.

## What it does

- Provides a research tool that:
 - Validates input with Zod (topic and prompt are required)
 - Uses the Chat service for status and progress messages
 - Calls a web-search-capable Gemini chat model via the AI Model Registry
 - Returns the generated research text along with a status/result object
- Exposes a simple TypeScript API if you want to call the tool implementation directly

## Features

- Web search-backed research via Gemini 2.5 Flash Web Search
- Strongly-typed parameters and results
- Token usage logging (prompt tokens, completion tokens, estimated cost) when available from the model response

## Global Scripting Functions

When `@tokenring-ai/scripting` is available, the research package registers native functions:

- **getResearchModel()**: Gets the configured research model name.
  ```bash
  /var $model = getResearchModel()
  /call getResearchModel()
  ```

This function allows scripts to query the research configuration:

```bash
# Check which model is being used for research
/var $model = getResearchModel()
/echo Using research model: $model
```

## Package entry points

- `index.ts` — package metadata and exports
- `tools.ts` — exports the `research` tool
- `tools/research.ts` — implementation (parameters, execute, description)

## Installation / Enabling in a Registry

This package is part of the monorepo and is typically used together with other Token Ring packages. To enable it within
a Registry instance:

```ts
import * as ResearchPackage from "@token-ring/research";
import { Registry } from "@token-ring/registry";

const registry = new Registry();
await registry.start();
await registry.addPackages(ResearchPackage);

// Enable tools from this package (all tools or specific ones)
await registry.tools.enableTools(Object.keys(ResearchPackage.tools));
```

In the Token Ring writer app (see src/tr-writer.ts), this package is added alongside other packages and its tools are
enabled by default unless overridden by config.

## Requirements

To successfully run research requests you need:

- A Chat service registered in the Registry (provided by `@token-ring/chat`)
- A ModelRegistry service registered and initialized with a Gemini model that supports web search (e.g.,
  `gemini-2.5-flash-web-search`) from `@token-ring/ai-client`
- Appropriate credentials/config for the Gemini provider set up via your model configuration

The writer app initializes models from `@token-ring/ai-client/models` and picks the first online client matching the
name `gemini-2.5-flash-web-search`.

## Exposed Tool

Tool name: `research`

- Description: Dispatches a research request to an AI agent and returns the generated research content.
- Parameters (Zod schema):
 - `topic: string` — The main topic or subject to research (required)
 - `prompt: string` — Detailed prompt or specific questions to investigate (required)
- Result (TypeScript union):
 - Success:
  - `status: "completed"`
  - `topic: string`
  - `research: string` — The generated research text
  - `message: string`
 - Error:
  - `status: "error"`
  - `topic: string` (may be empty when validation fails)
  - `error: string` — Error message
  - `message: string`

### Example: invoking the tool via the Registry

```ts
// assuming ResearchPackage was added and the tool enabled
const tool = registry.tools.getToolByName("research");
const result = await tool?.execute?.({
  topic: "Large Language Models",
  prompt: "Compare safety techniques and cite recent sources",
}, registry);

if (result?.status === "completed") {
  console.log(result.research);
} else {
  console.error(result?.message, result?.error);
}
```

### Example: direct API usage

You can import and call the underlying function directly if you already have a configured Registry (with ChatService and
ModelRegistry services available):

```ts
import {execute as researchExecute} from "@token-ring/research/tools/research";

const result = await researchExecute({
  topic: "Climate Tech Startups",
  prompt: "Summarize funding trends in 2024 and notable companies",
}, registry);
```

## Notes and Caveats

- The research tool requires access to a Gemini model with web search capability. Ensure the model is configured and
  reachable in your environment.
- The tool logs status messages to the Chat service; these appear in interactive sessions and logs.
- Token usage data is printed when provided by the model response but may not always be available.

## License

MIT (see repository LICENSE)