# @tokenring-ai/research

Topic-based research dossiers backed by markdown files on disk.

## Overview

The `@tokenring-ai/research` package provides a two-level document store for research
notes, using a topic/item layout:

- An **Item** is a single markdown file — one research note, summary, or deep-dive.
- A **Topic** is a named collection of related Items (e.g., a research project or
  subject area).

Items are typically written by research agents and organized into Topics, and
viewed/edited directly by users in the Research app.

### Key Features

- **Topics & Items**: Items are grouped into named Topics, stored as
  `<researchDirectory>/<topic>/<item>.md`
- **Shared or Per-Agent Directory**: One configured root directory by default, with
  optional per-agent overrides
- **CRUD via RPC**: List, create, retrieve, update, and delete topics and items from
  the frontend
- **CRUD via Tools**: Agents can list, read, write, and delete topics and items while
  doing research
- **Live List Updates**: `streamTopics` / `streamItems` poll the directory so the
  frontend list stays current
- **Auto-vivified Topics**: Writing an item to a topic that doesn't exist yet creates
  the topic automatically

### Integration Points

- **@tokenring-ai/chat**: Registers seven research tools with the ChatService
- **@tokenring-ai/rpc**: Exposes `/rpc/research` endpoint for the Research web app
- **@tokenring-ai/agent**: Attaches ResearchState to agents with configurable
  research directories

## Installation

```bash
bun add @tokenring-ai/research
```

## Tools

| Tool           | Display Name          | Description                                                    |
|----------------|-----------------------|----------------------------------------------------------------|
| `topic_list`   | Research/list topics  | List the research topics (collections of related markdown items) in the research directory |
| `topic_create` | Research/create topic | Create a new, empty research topic (a named collection of related markdown items) |
| `topic_delete` | Research/delete topic | Delete a research topic and all of the markdown items it contains |
| `item_list`    | Research/list items   | List the named markdown research items within a topic          |
| `item_read`    | Research/read item    | Read the markdown content of a research item within a topic    |
| `item_write`   | Research/write item   | Create or overwrite a research item (a single markdown file) within a topic. The topic is created automatically if it doesn't already exist. Use this to save research notes, summaries, and deep-dives so they can be referenced later or viewed by the user. |
| `item_delete`  | Research/delete item  | Delete a research item (a single markdown file) from a topic   |

## Configuration

Configure the research plugin in your application config:

```yaml
research:
  agentDefaults:
    researchDirectory: ./.tokenring/research
```

### Configuration Options

| Field                              | Type     | Required | Description                                  |
|------------------------------------|----------|----------|----------------------------------------------|
| `agentDefaults.researchDirectory`  | `string` | Yes      | Directory where research topics are stored   |

Agents may override `researchDirectory` via their own `research.researchDirectory`
agent config slice.

### Schema

```typescript
import {
  ResearchService,
  ResearchState,
  ResearchServiceConfigSchema,
  ResearchAgentConfigSchema,
  TopicSummarySchema,
  ItemSummarySchema,
  ItemSchema,
} from "@tokenring-ai/research";
```

Exported schemas:

- `ResearchServiceConfigSchema` — Plugin-level configuration
- `ResearchAgentConfigSchema` — Per-agent configuration override
- `TopicSummarySchema` — Topic metadata (`name`, `itemCount`, `updatedAt`)
- `ItemSummarySchema` — Item metadata (`topicName`, `name`, `size`, `updatedAt`)
- `ItemSchema` — Full item including `content`

## Naming

Topic and item names must start with a letter or number and may only contain letters,
numbers, hyphens, and underscores (`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`). An item named
`summary` in a topic named `solid-state-batteries` is stored at
`solid-state-batteries/summary.md` in the research directory.

## Service API

### ResearchService

```typescript
import { ResearchService } from "@tokenring-ai/research";

const researchService = agent.requireServiceByType(ResearchService);
```

| Method | Description |
|--------|-------------|
| `getDefaultResearchDirectory()` | Return the application default research directory |
| `getResearchDirectory(agent)` | Return the active agent's research directory |
| `listTopics(root)` | List topic summaries (`name`, `itemCount`, `updatedAt`) |
| `createTopic(root, topicName)` | Create a new, empty topic; throws if the name is already in use |
| `deleteTopic(root, topicName)` | Delete a topic and all of its items; returns `false` if it didn't exist |
| `listItems(root, topicName)` | List item summaries (`topicName`, `name`, `size`, `updatedAt`) within a topic |
| `getItem(root, topicName, name)` | Read an item's content, or `null` if it doesn't exist |
| `createItem(root, topicName, name, content)` | Create a new item, auto-creating its topic; throws if the name is already in use |
| `updateItem(root, topicName, name, content)` | Create or overwrite an item, auto-creating its topic |
| `deleteItem(root, topicName, name)` | Delete an item; returns `false` if it didn't exist |

### ResearchState

Agents maintain a `ResearchState` instance that holds the active research directory.
The state is initialized from `agentDefaults` and may be overridden per-agent.

```typescript
import { ResearchState } from "@tokenring-ai/research";

const state = agent.getState(ResearchState);
console.log(state.researchDirectory);
```

## RPC

The plugin registers a `Research RPC` endpoint at `/rpc/research` with the following
methods:

| Method | Type | Description |
|--------|------|-------------|
| `listTopics` | query | List all topics |
| `streamTopics` | stream | Polling stream of topics (3s interval) |
| `createTopic` | mutation | Create a new topic |
| `deleteTopic` | mutation | Delete a topic and its items |
| `listItems` | query | List items within a topic |
| `streamItems` | stream | Polling stream of items (3s interval) |
| `getItem` | query | Read an item's content |
| `createItem` | mutation | Create a new item |
| `updateItem` | mutation | Create or overwrite an item |
| `deleteItem` | mutation | Delete an item |

## Related Packages

- `@tokenring-ai/web-design` — Figma-style design flows and HTML designs
- `@tokenring-ai/websearch` — Web search tools used by research agents

## License

MIT License - see LICENSE file for details.
