# @tokenring-ai/research

**Version:** 0.2.0

## Overview

LLM-driven tools for systematic data gathering and deep analysis. This package
provides AI-powered research capabilities using web-search-enabled models,
integrating with the Token Ring agent, chat, and scripting systems to dispatch
research requests and return comprehensive research content with strict
adherence to factual accuracy and source citation.

### Key Features

- AI-powered research with web search capabilities
- Integration with Token Ring agent framework
- Tool-based interaction with agents (`research_run`)
- Scripting function for programmatic research (`research`)
- Artifact output generation for research results
- Strict adherence to factual accuracy and source citation
- Zero tolerance for hallucination with verbatim extraction
- Analytics tracking for research execution

## Features

- **AI-Powered Research**: Leverages advanced AI models with web search
  capabilities
- **Tool Integration**: Provides `research_run` tool for agent-based research
- **Scripting Support**: Exposes `research` function for programmatic usage
- **Artifact Output**: Automatically generates markdown artifacts for research
  results
- **Strict Factual Accuracy**: Enforces verbatim extraction and source citation
- **Analytics**: Tracks research execution metrics through chat service
- **Configurable Models**: Supports any AI model that provides web search
  functionality

## Chat Commands

This package does not define any chat commands. Research functionality is
accessed through tools and scripting functions.

## Tools

The package provides one agent tool that integrates with the TokenRing chat
system:

### research_run

Dispatches a research request to an AI Research Agent and returns the generated
research content.

| Tool           | Display Name      | Description                                        |
|----------------|-------------------|----------------------------------------------------|
| `research_run` | Research/research | Dispatches a research request to an AI agent, and  |
|                |                   | returns the generated research content.            |

**Input Parameters:**

| Parameter | Type   | Required | Description                                         |
|-----------|--------|----------|-----------------------------------------------------|
| `topic`   | string | Yes      | The main topic or subject to research               |
| `prompt`  | string | Yes      | The detailed research prompt or specific questions  |
|           |        |          | to investigate about the topic                      |

**Return Type:**

The tool returns a `TokenRingToolResult` with a JSON string containing:

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

## Configuration

The research package supports configuration through the Token Ring application
config system. The package defines a nested `research` configuration key.

### ENV Variables

This package does not define any environment variables. Configuration is done
through the plugin configuration object.

### Configuration Options

| Option          | Type   | Default            | Description                                         |
|-----------------|--------|--------------------|-----------------------------------------------------|
| `researchModel` | string | `auto?websearch`   | The AI model name for research (must support web    |
|                 |        |                    | search)                                             |

### Configuration Example

```yaml
research:
  researchModel: "auto?websearch"
```

Or with a specific model:

```yaml
research:
  researchModel: "gemini-2.5-flash-web-search"
```

## License

MIT License - see LICENSE file for details.
