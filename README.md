# @tokenring-ai/research

Deep research orchestration for TokenRing: spawn research agents, pin their working directory, and kick off multi-file research workflows.

## Overview

This package does **not** define agent prompts or tools for web search itself. It orchestrates the **deep research** agent configured by the application and exposes service, RPC, chat-tool, and scripting entry points.

| Surface | Role |
|---------|------|
| **ResearchService** | Creates `research` agents under `researchDirectory`, applies the filesystem working directory, starts `/deep research` |
| **RPC** (`/rpc/research`) | Powers the Research web app: start runs, read config, list past project folders |
| **Tool** `research_run` | Starts a deep research agent asynchronously; returns agent id + directory |
| **Scripting** `research(topic, prompt)` | Same as `startResearch`; returns JSON `{ agentId, researchDirectory }` |

Agent behavior (system prompts, enabled tools, slash commands) lives in app config:

| Agent | Config | Command |
|-------|--------|---------|
| Deep Research (`research`) | `app/one/config/agents/coding/research.yaml` | `/deep research` |
| Search Agent (`search-agent`) | `app/one/config/agents/coding/search-agent.yaml` | `/search agent` |

Search Agent is a lighter, chat-only verified web report. Deep Research writes a dossier on disk (`SUMMARY.md`, `TOC.md`, topic deep-dives) using web search, todos, and filesystem tools.

## Installation

```bash
bun add @tokenring-ai/research
```

Typically installed as part of TokenRing One (`@tokenring-ai/one`).

## Configuration

```ts
research: {
  // Absolute path, or relative to the project directory
  researchDirectory: ".tokenring/research",
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `researchDirectory` | `.tokenring/research` | Root directory for research project folders |

TokenRing One defaults this to `<dataDirectory>/research` (usually `<project>/.tokenring/research`).

## Flow

1. **`startResearch(query)`** ensures `researchDirectory` exists (`mkdir -p`).
2. Spawns an agent of type **`research`**.
3. Sets that agent’s filesystem **working directory** to the research root (`FileSystemState`).
4. Sends **`/deep research <query>`** as agent input.
5. With **`requireNewAgent: false`** (default on the command), steps run **in place** on that research agent (foreground chat), not as a nested subagent.

From a different agent type (for example `code`), `/deep research …` spawns a **background** research agent instead.

## ResearchService API

```ts
import ResearchService from "@tokenring-ai/research/ResearchService";

// startResearch(query, { headless? }) → { agentId, researchDirectory }
// resolveResearchDirectory() → string
// ensureResearchDirectory() → string
// listResearchProjects() → { name, path, modifiedAt }[]
// applyWorkingDirectory(agent) — pin FileSystemState.workingDirectory
// attach(agent) — auto-applies research directory for agentType === "research"
```

### `startResearch`

```ts
const { agentId, researchDirectory } = researchService.startResearch(
  "Solid-state battery commercialization 2024-2026",
  { headless: false },
);
```

Throws if the query is empty after trim.

### `listResearchProjects`

Returns immediate subdirectories of the research root (skips hidden names), sorted by modification time descending. Each completed deep-research run is expected to create its own project subdirectory under the root.

## RPC

Path: `/rpc/research`

| Method | Type | Input | Result |
|--------|------|-------|--------|
| `startResearch` | mutation | `{ query, headless? }` | `{ agentId, researchDirectory }` |
| `getResearchConfig` | query | `{}` | `{ researchDirectory }` (resolved absolute path) |
| `listResearchProjects` | query | `{}` | `{ projects: [{ name, path, modifiedAt }] }` |

## Tools

| Name | Display name | Description |
|------|--------------|-------------|
| `research_run` | Research/deep research | Starts deep research; returns JSON with `status: "started"`, `agentId`, `researchDirectory` |

**Input**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | yes | Main topic |
| `prompt` | string | yes | Detailed questions / focus (combined with topic into the query) |

Non-blocking: the tool returns as soon as the agent is created and `/deep research` is queued.

## Scripting

```ts
// Native function registered as `research`
research(topic, prompt) // → JSON string of StartResearchResult
```

## Research app (frontend)

The One web UI **Research** app (`/research`) calls `startResearch`, navigates to the new agent’s chat, and lists past project folders from `listResearchProjects`.

## Dependencies

- `@tokenring-ai/agent` — AgentManager, spawn, handleInput
- `@tokenring-ai/app` — plugin / service lifecycle
- `@tokenring-ai/chat` — tool registration
- `@tokenring-ai/filesystem` — `FileSystemState` working directory
- `@tokenring-ai/rpc` — Research RPC endpoint
- `@tokenring-ai/scripting` — `research()` function
- `zod` — config schema

## Related documentation

- Plugin docs: [Research plugin](../../docs/docs/plugins/research.md) (site: `/docs/plugins/research`)
- Agents: [Deep Research](../../docs/docs/agents/deep-research.md), [Search Agent](../../docs/docs/agents/search.md)
