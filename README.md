# @tokenring-ai/research

Topic-based research dossiers backed by markdown files on disk.

## Overview

The `@tokenring-ai/research` package provides a simple two-level document store for research notes, using a topic/item layout:

- An **Item** is a single markdown file — one research note, summary, or deep-dive.
- A **Topic** is a named collection of related Items (e.g. a research project or subject area).

Items are typically written by research agents and organized into Topics, and viewed/edited directly by users in the Research app.

## Key Features

- **Topics & Items**: Items are grouped into named Topics, stored as `<researchDirectory>/<topic>/<item>.md`
- **Shared or Per-Agent Directory**: One configured root directory by default, with optional per-agent overrides
- **CRUD via RPC**: List, create, retrieve, update, and delete topics and items from the frontend
- **CRUD via Tools**: Agents can list, read, write, and delete topics and items while doing research
- **Live List Updates**: `streamTopics` / `streamItems` poll the directory so the frontend list stays current
- **Auto-vivified Topics**: Writing an item to a topic that doesn't exist yet creates the topic automatically

## Installation

```bash
bun add @tokenring-ai/research
```

## Plugin Configuration

Configure the research plugin in your application config:

```yaml
research:
  agentDefaults:
    researchDirectory: ./.tokenring/research
```

### Configuration Schema

```typescript
import { ResearchServiceConfigSchema } from "@tokenring-ai/research";

ResearchServiceConfigSchema = z.object({
  agentDefaults: z.object({
    researchDirectory: z.string(),
  }),
});
```

**Configuration Options:**

| Field                              | Type     | Required | Description                           |
|------------------------------------|----------|----------|---------------------------------------|
| `agentDefaults.researchDirectory`  | `string` | Yes      | Directory where research topics are stored |

Agents may override `researchDirectory` via their own `research.researchDirectory` agent config slice.

## Naming

Topic and item names must start with a letter or number and may only contain letters, numbers, hyphens, and
underscores (`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`). An item named `summary` in a topic named `solid-state-batteries` is stored at
`solid-state-batteries/summary.md` in the research directory.

## Tools

| Tool           | Display Name               | Description                                                   |
|----------------|----------------------------|---------------------------------------------------------------|
| `topic_list`   | `Research/list topics`     | List the research topics in the research directory            |
| `topic_create` | `Research/create topic`    | Create a new, empty research topic                            |
| `topic_delete` | `Research/delete topic`    | Delete a research topic and all of its items                  |
| `item_list`    | `Research/list items`      | List the items within a topic                                 |
| `item_read`    | `Research/read item`       | Read the markdown content of an item                          |
| `item_write`   | `Research/write item`      | Create or overwrite an item (auto-creates its topic)          |
| `item_delete`  | `Research/delete item`     | Delete an item                                                |

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

## RPC

The plugin registers a `Research RPC` endpoint at `/rpc/research` with `listTopics`, `streamTopics`, `createTopic`,
`deleteTopic`, `listItems`, `streamItems`, `getItem`, `createItem`, `updateItem`, and `deleteItem`
methods, used by the Research app in the frontend.

## Related Packages

- `@tokenring-ai/web-design` - Figma-style design flows and HTML designs
- `@tokenring-ai/websearch` - Web search tools used by research agents
