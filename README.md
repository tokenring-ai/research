# @tokenring-ai/research

Research tools for the Token Ring ecosystem that provides AI-powered research capabilities using web-search-enabled models. This package integrates with the Token Ring agent, chat, and AI client systems to dispatch research requests and return comprehensive research content.

## Overview

The research package provides a ready-to-use research service that:
- Dispatches research requests to web-search-capable AI models (like Gemini 2.5 Flash Web Search)
- Validates input parameters with Zod schemas
- Integrates with Token Ring chat services for status messages and analytics
- Provides both tool-based and direct API access to research functionality
- Registers global scripting functions for programmatic access
- Includes comprehensive error handling and input validation

## Features

- **AI-Powered Research**: Uses web-search-enabled AI models to generate comprehensive research
- **Type-Safe APIs**: Strongly-typed parameters and results using Zod validation
- **Service Integration**: Deep integration with Token Ring agent, chat, and AI client services
- **Tool Registration**: Automatic tool registration with chat services
- **Scripting Support**: Global function registration for scripting environments
- **Analytics Integration**: Built-in token usage logging and chat analytics
- **Error Handling**: Comprehensive validation and error management

## Installation

This package is part of the Token Ring monorepo and is automatically available in Token Ring applications. When included in a Token Ring application, it will:

1. Register the `research` tool with the chat service
2. Register the global `research` function with the scripting service
3. Initialize the ResearchService when configuration is provided

## Configuration

The research package requires configuration through the Token Ring application's config system:

```typescript
// Example configuration
{
  research: {
    researchModel: "gemini-2.5-flash-web-search" // Required: AI model name
  }
}
```

### Configuration Schema

```typescript
const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(), // Required: Name of the AI model for research
});
```

**Required Configuration:**
- `researchModel`: String identifier for the AI model that supports web search (e.g., "gemini-2.5-flash-web-search")

## Core Components

### ResearchService

The main service that handles research requests:

```typescript
class ResearchService implements TokenRingService {
  name = "ResearchService";
  description = "Provides Research functionality";
  
  async runResearch(topic: string, prompt: string, agent: Agent): Promise<string>
}
```

**Methods:**
- `runResearch(topic, prompt, agent)`: Executes research and returns comprehensive research text

### Research Tool

The research tool is automatically registered with chat services and provides:

```typescript
interface ResearchArgs {
  topic: string;      // The main topic or subject to research
  prompt: string;     // Detailed research questions to investigate
}

type ResearchResult = ResearchSuccessResult | ResearchErrorResult;

interface ResearchSuccessResult {
  status: "completed";
  topic: string;
  research: string;
  message: string;
}

interface ResearchErrorResult {
  status: "error";
  topic: string;
  error: string;
  message: string;
}
```

## Usage Examples

### Basic Tool Usage

```typescript
// Using the research tool through chat service
const result = await chatService.executeTool("research", {
  topic: "Large Language Models",
  prompt: "Compare safety techniques and cite recent sources"
});

// Result handling
if (result.status === "completed") {
  console.log(result.research);
} else {
  console.error(result.error);
}
```

### Direct Service Usage

```typescript
import ResearchService from "@tokenring-ai/research";

const researchService = new ResearchService({
  researchModel: "gemini-2.5-flash-web-search"
});

const agent = /* your agent instance */;
const research = await researchService.runResearch(
  "Climate Tech Startups",
  "Summarize funding trends in 2024 and notable companies",
  agent
);

console.log(research);
```

### Scripting Function

When `@tokenring-ai/scripting` is available, the research package registers a global function:

```javascript
// Global function signature
research(topic: string, prompt: string): Promise<string>

// Usage in scripting context
const research = await research(
  "Quantum Computing",
  "What are the latest breakthroughs and commercial applications?"
);
```

## Plugin Integration

The research package automatically integrates with Token Ring applications through its plugin:

```typescript
export default {
  name: "@tokenring-ai/research",
  version: "0.2.0",
  install(app: TokenRingApp) {
    // 1. Register scripting function when ScriptingService is available
    app.services.waitForItemByType(ScriptingService, (scriptingService) => {
      scriptingService.registerFunction("research", {
        type: 'native',
        params: ["topic", "prompt"],
        async execute(this: ScriptingThis, topic: string, prompt: string): Promise<string> {
          return await this.agent.requireServiceByType(ResearchService).runResearch(topic, prompt, this.agent);
        }
      });
    });

    // 2. Register research tool with chat service
    app.waitForService(ChatService, chatService => 
      chatService.addTools(packageJSON.name, tools)
    );

    // 3. Initialize ResearchService when configuration is present
    const config = app.getConfigSlice('research', ResearchServiceConfigSchema.optional());
    if (config) {
      app.addServices(new ResearchService(config));
    }
  }
}
```

## Service Dependencies

The research package requires these services to be available:

1. **ChatService**: For status messages, progress updates, and analytics
2. **ScriptingService**: For global function registration (optional but recommended)
3. **ModelRegistry** (via agent): For accessing AI models through ChatModelRegistry
4. **Agent**: For accessing services and system messages

## API Reference

### ResearchService.runResearch()

```typescript
async runResearch(topic: string, prompt: string, agent: Agent): Promise<string>
```

**Parameters:**
- `topic` (string): The main topic or subject to research
- `prompt` (string): Detailed research questions or specific aspects to investigate
- `agent` (Agent): The current agent instance for service access

**Returns:**
- `Promise<string>`: Generated research content

**Process:**
1. Retrieves AI client from model registry using configured research model
2. Sends system message indicating research dispatch
3. Executes research using AI chat with web search capability
4. Logs completion and outputs research to chat
5. Records analytics data
6. Returns generated research text

### Research Tool Execute

```typescript
async function execute(
  {topic, prompt}: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<ResearchResult>
```

**Input Schema:**
```typescript
const inputSchema = z.object({
  topic: z.string().describe("The main topic or subject to research"),
  prompt: z.string().describe("The detailed research prompt or specific questions to investigate about the topic")
});
```

**Error Handling:**
- Validates that `topic` is provided
- Validates that `prompt` is provided
- Throws descriptive errors for missing parameters
- Returns error result object on execution failures

## Integration with Token Ring Ecosystem

### Agent Integration

```typescript
// Agents can access research service directly
const researchService = agent.requireServiceByType(ResearchService);
const research = await researchService.runResearch(topic, prompt, agent);
```

### Chat Service Integration

```typescript
// Automatic tool registration
chatService.addTools("@tokenring-ai/research", {research});

// Tool execution through chat
const result = await chatService.executeTool("research", {topic, prompt});
```

### Scripting Integration

```typescript
// Global function registration (when scripting available)
scriptingService.registerFunction("research", {
  type: 'native',
  params: ["topic", "prompt"],
  async execute(/* ... */)
});
```

## Development

### Package Structure

- `index.ts` - Package exports
- `plugin.ts` - Plugin integration logic
- `ResearchService.ts` - Core service implementation
- `tools.ts` - Tool exports
- `tools/research.ts` - Tool implementation and schemas
- `package.json` - Package configuration

### Dependencies

```json
{
  "dependencies": {
    "@tokenring-ai/app": "0.2.0",
    "@tokenring-ai/ai-client": "0.2.0",
    "@tokenring-ai/chat": "0.2.0",
    "@tokenring-ai/agent": "0.2.0",
    "@tokenring-ai/scripting": "0.2.0",
    "zod": "catalog:"
  },
  "devDependencies": {
    "vitest": "catalog:",
    "typescript": "catalog:"
  }
}
```

### Testing

The package includes Vitest configuration for testing:

```typescript
// vitest.config.ts
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
    globals: true,
    isolate: true,
  },
});
```

## Error Handling

The research package provides comprehensive error handling:

1. **Input Validation**: Zod schemas validate all inputs before execution
2. **Service Dependencies**: Graceful handling when required services aren't available
3. **Model Access**: Proper error handling when AI models are unavailable
4. **Execution Errors**: Catch and report errors during research generation
5. **Timeout Handling**: Proper timeout management through agent configuration

## Performance Considerations

- **Model Selection**: Uses model registry to find first available research model
- **Async Operations**: All research operations are properly asynchronous
- **Resource Cleanup**: Proper cleanup of AI client resources
- **Analytics**: Built-in analytics collection without performance impact

## License

MIT (see LICENSE file)