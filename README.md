# @tokenring-ai/research

## Overview

Research tools for Token Ring that provides AI-powered research capabilities using web-search-enabled models. This package integrates with the Token Ring agent, chat, and AI client systems to dispatch research requests and return comprehensive research content.

## Chat Commands

This package provides a global `research` function that can be used in scripting contexts:

```typescript
// Function signature
research(topic: string, prompt: string): Promise<string>

// Usage example
const research = await research(
  "Quantum Computing",
  "What are the latest breakthroughs and commercial applications?"
);
```

## Plugin Configuration

The research package supports configuration through the Token Ring application config system:

```typescript
// Configuration schema
const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema.optional()
});
```

### Configuration Options

```typescript
const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
});
```

**Configuration example:**

```typescript
{
  research: {
    researchModel: "gemini-2.5-flash-web-search"  // Required: AI model name that supports web search
  }
}
```

## Agent Configuration

The ResearchService can attach additional configuration to agents through the agent configuration system. This package doesn't define additional agent configuration schemas.

## Tools

This package provides the following tool:

### research

Dispatches a research request to an AI Research Agent and returns the generated research content.

**Tool definition:**

```typescript
const research = {
  name: "research",
  description: "Dispatches a research request to an AI agent, and returns the generated research content.",
  inputSchema: z.object({
    topic: z.string().describe("The main topic or subject to research"),
    prompt: z.string().describe("The detailed research prompt or specific questions to investigate about the topic"),
  }),
  execute: async function({topic, prompt}, agent): Promise<ResearchResult> {
    // Implementation...
  }
};
```

**Input parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| topic | string | The main topic or subject to research |
| prompt | string | The detailed research prompt or specific questions to investigate about the topic |

**Result types:**

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

The main service that handles research requests.

**Service interface:**

```typescript
export default class ResearchService implements TokenRingService {
  name = "ResearchService";
  description = "Provides Research functionality";
  researchModel: string;

  constructor({ researchModel }: ResearchServiceConfig) {
    this.researchModel = researchModel;
  }

  async runResearch(topic: string, prompt: string, agent: Agent): Promise<string> {
    // Implementation...
  }
}
```

**Constructor parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| config | ResearchServiceConfig | Configuration object containing researchModel |

**ResearchServiceConfig:**

```typescript
type ResearchServiceConfig = {
  researchModel: string;  // The AI model name for research (must support web search)
};
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| runResearch | `(topic: string, prompt: string, agent: Agent) => Promise<string>` | Executes research and returns comprehensive research text |

## State Management

The ResearchService does not maintain persistent state. Each research request is processed independently and returns a result without storing intermediate state. The service interacts with:

- **ChatModelRegistry**: Retrieves the configured AI model for research
- **Agent**: Uses the agent's system message and chat output capabilities
- **ChatService**: Provides analytics and output through the agent's chat interface

Research results are returned directly to the caller and are not persisted beyond the request lifecycle.

## License

MIT License - see [LICENSE](./LICENSE) file for details.
