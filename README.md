# @tokenring-ai/research

## Overview

Research tools for Token Ring that provides AI-powered research capabilities using web-search-enabled models. This package integrates with the Token Ring agent, chat, and AI client systems to dispatch research requests and return comprehensive research content.

## Installation

```bash
bun install @tokenring-ai/research
```

## Features

- AI-powered research with web search capabilities
- Integration with Token Ring agent framework
- Tool-based interaction with agents
- Scripting function for programmatic research
- Artifact output generation for research results

## Plugin Configuration

The research package supports configuration through the Token Ring application config system. The package defines a nested `research` configuration key.

### Configuration Schema

```typescript
const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
});

const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema.optional()
});
```

### Configuration Example

```typescript
const pluginConfig = {
  research: {
    researchModel: "gemini-2.5-flash-web-search"  // Required: AI model name that supports web search
  }
};
```

### Plugin Registration

```typescript
import researchPlugin from "@tokenring-ai/research";
import app from "@tokenring-ai/app";

const appInstance = new app.App();

appInstance.addPlugin(researchPlugin, {
  research: {
    researchModel: "gemini-2.5-flash-web-search"
  }
});
```

## Agent Configuration

This package does not provide agent-level configuration. Research interactions are managed through tools and scripting functions.

## Tools

The package provides one agent tool that integrates with the TokenRing chat system:

### research_run

Dispatches a research request to an AI Research Agent and returns the generated research content.

**Tool Definition:**

```typescript
{
  name: "research_run",
  displayName: "Research/research",
  description: "Dispatches a research request to an AI agent, and returns the generated research content.",
  inputSchema: z.object({
    topic: z.string().describe("The main topic or subject to research"),
    prompt: z.string().describe("The detailed research prompt or specific questions to investigate about the topic")
  }),
  execute
}
```

**Parameters:**

- `topic` (string): The main topic or subject to research
- `prompt` (string): The detailed research prompt or specific questions to investigate about the topic

**Return Type:**

```typescript
interface ResearchSuccessResult {
  status: "completed";
  topic: string;
  research: string;
  message: string;
}
```

**Features:**

- Uses configured research model with web search capabilities
- Generates comprehensive research content
- Creates artifact output for research results
- Provides detailed analytics on research execution

**Usage Example:**

```typescript
// Execute research through agent tool
await agent.callTool('research_run', {
  topic: 'Quantum Computing',
  prompt: 'What are the latest breakthroughs and commercial applications?'
});
```

## Services

### ResearchService

The main service class that implements `TokenRingService`. It manages research requests using configured AI models.

**Service Properties:**

- `name`: Service identifier ("ResearchService")
- `description`: Service description ("Provides Research functionality")

**Constructor Parameters:**

```typescript
interface ResearchServiceConfig {
  researchModel: string;  // The AI model name for research (must support web search)
}
```

**Methods:**

```typescript
runResearch(topic: string, prompt: string, agent: Agent): Promise<string>
```

**Method Description:**

- `runResearch(topic, prompt, agent)`: Executes research using the configured AI model and returns comprehensive research text

**Implementation Details:**

- Retrieves the configured research model from the agent's ChatModelRegistry
- Sends a system message instructing the AI to research the topic using web search with strict adherence to factual accuracy
- Returns detailed research content as a string
- Generates artifact output with the research results in markdown format
- Provides analytics on the research execution through outputChatAnalytics

**Dependencies:**

- `ChatModelRegistry`: Retrieves the configured AI model for research
- `Agent`: Uses the agent's system message and chat output capabilities
- `ChatService`: Provides analytics and output through the agent's chat interface

## Scripting Function

The package registers a global `research` function that can be used in scripting contexts through the ScriptingService:

```typescript
// Function signature
research(topic: string, prompt: string): Promise<string>

// Usage example
const research = await research(
  "Quantum Computing",
  "What are the latest breakthroughs and commercial applications?"
);
```

The function is automatically registered with the ScriptingService when the plugin is installed and can be used in scripting contexts without manual registration.

## State Management

The ResearchService does not maintain persistent state. Each research request is processed independently and returns a result without storing intermediate state. The service interacts with:

- **ChatModelRegistry**: Retrieves the configured AI model for research
- **Agent**: Uses the agent's system message and chat output capabilities
- **ChatService**: Provides analytics and output through the agent's chat interface

Research results are returned directly to the caller and are not persisted beyond the request lifecycle.

## Usage Examples

### 1. Using with TokenRing Plugin

```typescript
import app from "@tokenring-ai/app";
import researchPlugin from "@tokenring-ai/research";

const appInstance = new app.App();

appInstance.addPlugin(researchPlugin, {
  research: {
    researchModel: "gemini-2.5-flash-web-search"
  }
});
```

### 2. Using Tools in Agents

```typescript
import { Agent } from "@tokenring-ai/agent";
import { ResearchService } from "@tokenring-ai/research";

const agent = new Agent();
const researchService = agent.requireServiceByType(ResearchService);

// Execute research
const research = await researchService.runResearch(
  'Artificial Intelligence',
  'What are the current trends in AI development?',
  agent
);

console.log('Research results:', research);
```

### 3. Using Scripting Function

```typescript
// The research function is automatically registered by the plugin
const research = await research(
  'Machine Learning',
  'Explain the latest advances in transformer models'
);
console.log(research);
```

### 4. Direct Service Usage

```typescript
import { ResearchService } from "@tokenring-ai/research";
import { Agent } from "@tokenring-ai/agent";

const researchService = new ResearchService({
  researchModel: "gemini-2.5-flash-web-search"
});

const agent = new Agent();
agent.addServices(researchService);

const research = await researchService.runResearch(
  'Web3 Technologies',
  'What are the current trends in decentralized identity?',
  agent
);
```

## Integration

### Tool Registration

Tools are registered through the plugin's install method:

```typescript
app.waitForService(ChatService, chatService => {
  chatService.addTools(tools);
});
```

### Scripting Function Registration

```typescript
app.services.waitForItemByType(ScriptingService, (scriptingService: ScriptingService) => {
  scriptingService.registerFunction("research", {
    type: 'native',
    params: ["topic", "prompt"],
    async execute(this: ScriptingThis, topic: string, prompt: string): Promise<string> {
      return await this.agent.requireServiceByType(ResearchService).runResearch(topic, prompt, this.agent);
    }
  });
});
```

## Best Practices

- **Model Selection**: Choose a research model that supports web search capabilities (e.g., "gemini-2.5-flash-web-search")
- **Topic Clarity**: Provide clear, specific topics and prompts for the best research results
- **Artifact Output**: Research results are automatically output as artifacts for easy access
- **Analytics**: Use the analytics provided by the agent's chat service to monitor research performance
- **Error Handling**: Handle potential errors from the AI model or network issues gracefully
- **Tool Usage**: Use tools (`research_run`) instead of direct service calls for better integration

## Testing and Development

### Running Tests

```bash
bun test
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
    globals: true,
    isolate: true,
  },
});
```

### Package Structure

```
pkg/research/
├── index.ts                         # Package entry point and exports
├── ResearchService.ts               # Core service for research operations
├── plugin.ts                        # TokenRing plugin integration
├── tools.ts                         # Tool exports
├── tools/
│   └── research.ts                  # Research tool implementation
├── package.json                     # Package metadata and dependencies
└── vitest.config.ts                 # Test configuration
```

### Build Instructions

```bash
bun run build
```

### Dependencies

**Production Dependencies:**

- `@tokenring-ai/agent` - Central orchestration system
- `@tokenring-ai/app` - Base application framework and plugin system
- `@tokenring-ai/chat` - Chat service and context handling
- `@tokenring-ai/ai-client` - AI model registry and client
- `@tokenring-ai/scripting` - Scripting functions and execution
- `zod` - Runtime type validation and schema definition

**Development Dependencies:**

- `vitest` - Unit testing framework
- `typescript` - TypeScript compiler

## Related Components

- `@tokenring-ai/app`: Base application framework and plugin system
- `@tokenring-ai/agent`: Agent-based orchestration
- `@tokenring-ai/ai-client`: AI model registry and client
- `@tokenring-ai/chat`: Chat service and context handling
- `@tokenring-ai/scripting`: Scripting functions and execution

## License

MIT License - see [LICENSE](./LICENSE) file for details.
