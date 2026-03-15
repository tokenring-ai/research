# @tokenring-ai/research

## Overview

Research tools for Token Ring that provides AI-powered research capabilities using web-search-enabled models. This package integrates with the Token Ring agent, chat, and AI client systems to dispatch research requests and return comprehensive research content with strict adherence to factual accuracy and source citation.

### Key Features

- AI-powered research with web search capabilities
- Integration with Token Ring agent framework
- Tool-based interaction with agents (`research_run`)
- Scripting function for programmatic research (`research`)
- Artifact output generation for research results
- Strict adherence to factual accuracy and source citation
- Zero tolerance for hallucination with verbatim extraction
- Analytics tracking for research execution

## Installation

```bash
bun install @tokenring-ai/research
```

## Features

- **AI-Powered Research**: Leverages advanced AI models with web search capabilities
- **Tool Integration**: Provides `research_run` tool for agent-based research
- **Scripting Support**: Exposes `research` function for programmatic usage
- **Artifact Output**: Automatically generates markdown artifacts for research results
- **Strict Factual Accuracy**: Enforces verbatim extraction and source citation
- **Analytics**: Tracks research execution metrics through chat service
- **Configurable Models**: Supports any AI model that provides web search functionality

## Core Components/API

### ResearchService

The main service class that implements `TokenRingService`. It manages research requests using configured AI models.

#### Properties

- `name`: Service identifier (`"ResearchService"`)
- `description`: Service description (`"Provides Research functionality"`)

#### Constructor

```typescript
constructor(options: ResearchServiceConfig)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `ResearchServiceConfig` | Configuration object containing research model settings |

#### Methods

```typescript
async runResearch(topic: string, prompt: string, agent: Agent): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `topic` | string | The main topic or subject to research |
| `prompt` | string | The detailed research prompt or specific questions to investigate |
| `agent` | Agent | The agent instance for service access and output |

**Returns:**

- `Promise<string>`: Comprehensive research content as a string

**Description:**

Executes research using the configured AI model with web search capabilities. The method:

1. Retrieves the configured research model from the agent's `ChatModelRegistry`
2. Sends a system message instructing the AI to research the topic with strict adherence to factual accuracy
3. Returns detailed research content as a string
4. Generates artifact output with the research results in markdown format
5. Provides analytics on the research execution through `getChatAnalytics`

### Tools

The package provides one agent tool that integrates with the TokenRing chat system:

#### research_run

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | Yes | The main topic or subject to research |
| `prompt` | string | Yes | The detailed research prompt or specific questions to investigate about the topic |

**Return Type:**

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

**Features:**

- Uses configured research model with web search capabilities
- Generates comprehensive research content with strict factual accuracy
- Creates artifact output for research results in markdown format
- Provides detailed analytics on research execution
- Enforces source citation and verbatim extraction from reliable sources

### Configuration Schema

```typescript
import { ResearchServiceConfigSchema } from "@tokenring-ai/research/schema";

const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema.prefault({})
});
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `researchModel` | string | `"auto?websearch"` | The AI model name for research (must support web search) |

## Usage Examples

### 1. Using with TokenRing Plugin

```typescript
import app from "@tokenring-ai/app";
import researchPlugin from "@tokenring-ai/research";

const appInstance = new app.App();

appInstance.addPlugin(researchPlugin, {
  research: {
    researchModel: "auto?websearch"
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
const researchResult = await research(
  'Machine Learning',
  'Explain the latest advances in transformer models'
);
console.log(researchResult);
```

### 4. Direct Service Usage

```typescript
import { ResearchService } from "@tokenring-ai/research";
import { Agent } from "@tokenring-ai/agent";

const researchService = new ResearchService({
  researchModel: "auto?websearch"
});

const agent = new Agent();
agent.addServices(researchService);

const research = await researchService.runResearch(
  'Web3 Technologies',
  'What are the current trends in decentralized identity?',
  agent
);

console.log('Research:', research);
```

### 5. Error Handling

```typescript
try {
  const research = await research(
    'Quantum Computing',
    'Latest breakthroughs in 2024'
  );
  console.log('Research completed:', research);
} catch (error) {
  console.error('Research failed:', error.message);
}
```

### 6. Using the research_run Tool

```typescript
// Execute research through agent tool
await agent.callTool('research_run', {
  topic: 'Quantum Computing',
  prompt: 'What are the latest breakthroughs and commercial applications?'
});
```

## Configuration

The research package supports configuration through the Token Ring application config system. The package defines a nested `research` configuration key.

### Configuration Schema

```typescript
import { ResearchServiceConfigSchema } from "@tokenring-ai/research/schema";

const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema.prefault({})
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `researchModel` | string | `"auto?websearch"` | The AI model name for research (must support web search) |

### Configuration Example

```typescript
const pluginConfig = {
  research: {
    researchModel: "auto?websearch"  // Default: AI model that supports web search
  }
};

// Or with a specific model
const pluginConfig = {
  research: {
    researchModel: "gemini-2.5-flash-web-search"  // Specific model with web search
  }
};
```

### Plugin Registration

```typescript
import app from "@tokenring-ai/app";
import researchPlugin from "@tokenring-ai/research";

const appInstance = new app.App();

appInstance.addPlugin(researchPlugin, {
  research: {
    researchModel: "auto?websearch"
  }
});
```

## RPC Endpoints

This package does not define any RPC endpoints. Research functionality is accessed through:

- **Agent Tools**: `research_run` tool for agent-based research
- **Scripting Functions**: `research` function for programmatic usage
- **Direct Service Calls**: `ResearchService.runResearch()` method

## Integration

### Tool Registration

Tools are registered through the plugin's install method:

```typescript
app.waitForService(ChatService, chatService => {
  chatService.addTools(tools);
});
```

Where `tools` is exported from `@tokenring-ai/research/tools`:

```typescript
import tools from "@tokenring-ai/research/tools";

// tools = { research: { name: "research_run", ... } }
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

### Service Registration

The service is automatically registered when the plugin is installed:

```typescript
app.addServices(new ResearchService(config.research));
```

## State Management

The ResearchService does not maintain persistent state. Each research request is processed independently and returns a result without storing intermediate state. The service interacts with:

- **ChatModelRegistry**: Retrieves the configured AI model for research
- **Agent**: Uses the agent's system message and chat output capabilities
- **ChatService**: Provides analytics and output through the agent's chat interface

Research results are returned directly to the caller and are not persisted beyond the request lifecycle.

## Best Practices

- **Model Selection**: Choose a research model that supports web search capabilities (e.g., `"auto?websearch"` or `"gemini-2.5-flash-web-search"`)
- **Topic Clarity**: Provide clear, specific topics and prompts for the best research results
- **Artifact Output**: Research results are automatically output as artifacts for easy access
- **Analytics**: Use the analytics provided by the agent's chat service to monitor research performance
- **Error Handling**: Handle potential errors from the AI model or network issues gracefully
- **Tool Usage**: Use tools (`research_run`) instead of direct service calls for better integration
- **Source Verification**: The research AI is configured to verify sources and cite them appropriately
- **Factual Accuracy**: Trust the strict guidelines that prevent hallucination and speculation
- **System Instructions**: The research AI follows strict guidelines for verbatim extraction, source citation, and zero tolerance for hallucination

## System Instructions

The research AI follows strict guidelines:

1. **Verbatim Extraction**: Extracts relevant text verbatim from sources
2. **Source Citation**: Every claim must be accompanied by a specific URL or named reputable source
3. **Zero Tolerance for Hallucination**: States when information cannot be found
4. **Conflicting Data**: Reports both perspectives when sources conflict
5. **No Speculation**: Returns only explicitly documented information

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
├── schema.ts                        # Configuration schema definitions
├── package.json                     # Package metadata and dependencies
└── vitest.config.ts                 # Test configuration
```

### Build Instructions

```bash
bun run build
```

## Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tokenring-ai/agent` | 0.2.0 | Central orchestration system |
| `@tokenring-ai/app` | 0.2.0 | Base application framework and plugin system |
| `@tokenring-ai/chat` | 0.2.0 | Chat service and context handling |
| `@tokenring-ai/ai-client` | 0.2.0 | AI model registry and client |
| `@tokenring-ai/scripting` | 0.2.0 | Scripting functions and execution |
| `zod` | ^4.3.6 | Runtime type validation and schema definition |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.1.0 | Unit testing framework |
| `typescript` | ^5.9.3 | TypeScript compiler |

## Related Components

- `@tokenring-ai/app`: Base application framework and plugin system
- `@tokenring-ai/agent`: Agent-based orchestration
- `@tokenring-ai/ai-client`: AI model registry and client
- `@tokenring-ai/chat`: Chat service and context handling
- `@tokenring-ai/scripting`: Scripting functions and execution

## License

MIT License - see [LICENSE](./LICENSE) file for details.
