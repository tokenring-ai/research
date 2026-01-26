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

## Chat Commands

This package does not define any chat commands. Research operations are handled through the tool system.

## Plugin Configuration

The research package supports configuration through the Token Ring application config system:

```typescript
const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
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

const app = new app.App();

app.addPlugin(researchPlugin, {
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
  description: "Dispatches a research request to an AI agent, and returns the generated research content.",
  inputSchema: {
    topic: string        // Required: The main topic or subject to research
    prompt: string       // Required: The detailed research prompt or specific questions to investigate about the topic
  }
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

// Execute research programmatically through scripting
const research = await research(
  'Artificial Intelligence',
  'What are the current trends in AI development?'
);
```

**Result Types:**

```typescript
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

type ResearchResult = ResearchSuccessResult | ResearchErrorResult;
```

## Services

### ResearchService

The main service class that implements `TokenRingService`. It manages research requests using configured AI models.

**Service Interface:**

```typescript
interface TokenRingService {
  name: string;
  description: string;
  researchModel: string;
}
```

**Service Properties:**

- `name`: Service identifier ("ResearchService")
- `description`: Service description ("Provides Research functionality")
- `researchModel`: String - The configured AI model name for research (must support web search)

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
- Sends a system message instructing the AI to research the topic using web search
- Returns detailed research content as a string
- Generates artifact output with the research results
- Provides analytics on the research execution

**Dependencies:**
- `ChatModelRegistry`: Retrieves the configured AI model for research
- `Agent`: Uses the agent's system message and chat output capabilities
- `ChatService`: Provides analytics and output through the agent's chat interface

## Scripting Function

The package registers a global `research` function that can be used in scripting contexts:

```typescript
// Function signature
research(topic: string, prompt: string): Promise<string>

// Usage example
const research = await research(
  "Quantum Computing",
  "What are the latest breakthroughs and commercial applications?"
);
```

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

const app = new app.App();

app.addPlugin(researchPlugin, {
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
import scriptingService from "@tokenring-ai/scripting";

// Register research function (handled automatically by plugin)
const research = await research(
  'Machine Learning',
  'Explain the latest advances in transformer models'
);
console.log(research);
```

### 4. Managing Multiple Research Models

```typescript
import app from "@tokenring-ai/app";
import researchPlugin from "@tokenring-ai/research";

const app = new app.App();

// Configure multiple research plugins with different models
app.addPlugin(researchPlugin, {
  name: 'research-fast',
  research: {
    researchModel: 'gemini-2.0-flash-exp'
  }
});

app.addPlugin(researchPlugin, {
  name: 'research-deep',
  research: {
    researchModel: 'gemini-2.5-flash-web-search'
  }
});
```

## Integration

### FileSystemService

The ResearchService uses the agent's FileSystemService indirectly through artifact output capabilities.

### Agent

The plugin integrates with the agent system through several mechanisms:

**Tool Registration:**

Tools are registered through the plugin's install method:

```typescript
app.waitForService(ChatService, chatService => {
  chatService.addTools(packageJSON.name, tools);
});
```

**Scripting Function Registration:**

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

- `@tokenring-ai/agent` - Central orchestration system
- `@tokenring-ai/app` - Base application framework and plugin system
- `@tokenring-ai/chat` - Chat service and context handling
- `@tokenring-ai/ai-client` - AI model registry and client
- `@tokenring-ai/scripting` - Scripting functions and execution
- `zod` - Runtime type validation and schema definition

## Related Components

- `@tokenring-ai/app`: Base application framework and plugin system
- `@tokenring-ai/agent`: Agent-based orchestration
- `@tokenring-ai/ai-client`: AI model registry and client
- `@tokenring-ai/chat`: Chat service and context handling
- `@tokenring-ai/scripting`: Scripting functions and execution

## License

MIT License - see [LICENSE](./LICENSE) file for details.
