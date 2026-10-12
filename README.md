# @tokenring-ai/research

Topic-based research dossiers backed by markdown files on disk.

## Overview

The `@tokenring-ai/research` package provides a two-level document store for research
notes, using a topic/item layout:

- An **Item** is a single markdown file — one research note, summary, or deep-dive.
- A **Topic** is a named collection of related Items (e.g., a research project or
  subject area).

Items are typically written by research agents and organized into Topics, and
viewed/edited directly by users in the Research web app.

The package also ships a **Deep Research** agent definition that uses web search,
todos, and the research tools to produce thorough multi-file research dossiers.

### Integration Points

- **@tokenring-ai/chat**: Registers seven research tools with the ChatService
- **@tokenring-ai/rpc**: Exposes `/rpc/research` endpoint for the Research web app
- **@tokenring-ai/agent**: Attaches `ResearchState` to agents with configurable
  research directories
- **@tokenring-ai/lifecycle**: Registers the `addSelectedItem` hook via
  `AgentLifecycleService`

## Key Features

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
- **Deep Research Agent**: Ships a research agent definition and `/deep research`
  command for multi-file research dossiers
- **Search, Export, Move**: Case-insensitive search across every topic (names, title
  headings and content, with snippets), Markdown export of a dossier or a whole topic,
  and rename / move of a dossier between topics
- **Dashboard**: The Research navigator has a search box, per-topic export, and shows
  the attached research agent's todo list (also on the landing panel); dossier panels
  offer rename / move (open panels, unsaved drafts and the URL follow the file) and a
  Markdown download of what is on screen
- **Selected Item Attachments**: A lifecycle hook automatically attaches the currently
  selected research item to new chat messages

## Installation

```bash
bun add @tokenring-ai/research
```

## Chat Commands

| Command | Description |
|---------|-------------|
| `/deep research` | Perform deep multi-file research on a topic or goal |

The `/deep research` command starts a deep research run that writes a structured
markdown dossier. The agent will:

- Create a research topic under the research directory
- Plan with todos
- Search and cite web sources
- Write markdown items (summary, toc, and per-section deep-dives)

When run on a research agent, work continues in the foreground on that agent. When
run from another agent type, a background research agent is started.

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

All tools operate against the agent's configured research directory.

### Tool Input Parameters

#### `topic_list`

No input parameters.

#### `topic_create`

| Parameter | Type     | Description                     |
|-----------|----------|---------------------------------|
| `name`    | `string` | Name of the topic to create     |

#### `topic_delete`

| Parameter | Type     | Description                     |
|-----------|----------|---------------------------------|
| `name`    | `string` | Name of the topic to delete     |

#### `item_list`

| Parameter  | Type     | Description                              |
|------------|----------|------------------------------------------|
| `topicName`| `string` | Name of the topic to list items from     |

#### `item_read`

| Parameter  | Type     | Description                              |
|------------|----------|------------------------------------------|
| `topicName`| `string` | Name of the topic the item belongs to    |
| `name`     | `string` | Name of the item to read                 |

#### `item_write`

| Parameter  | Type     | Description                                                                    |
|------------|----------|--------------------------------------------------------------------------------|
| `topicName`| `string` | Name of the topic this item belongs to; created automatically if it doesn't exist |
| `name`     | `string` | Name of the item to create or update                                           |
| `content`  | `string` | Full markdown content of the research item                                     |

#### `item_delete`

| Parameter  | Type     | Description                              |
|------------|----------|------------------------------------------|
| `topicName`| `string` | Name of the topic the item belongs to    |
| `name`     | `string` | Name of the item to delete               |

### Config-Defined Tool

The package also provides a config-defined tool (registered via agent config, not
exported in `tools.ts`):

| Tool            | Display Name               | Description                                                                    |
|-----------------|----------------------------|--------------------------------------------------------------------------------|
| `deep_research` | Research Agents/Deep Research | Start a deep multi-file research project on a topic. Writes markdown items under a research topic. |

This tool accepts a `prompt` (the topic or goal to research deeply) and optional
`context` (conversation context or constraints). It spawns a research agent to
perform the work.

## Configuration

Configure the research plugin in your application config:

```yaml
research:
  agentDefaults:
    researchDirectory: research
  agentTypes:
    - research
```

### Configuration Options

| Field                             | Type       | Required | Default      | Description                                |
|-----------------------------------|------------|----------|--------------|--------------------------------------------|
| `agentDefaults.researchDirectory` | `string`   | No       | `"research"` | Directory where research topics are stored |
| `agentTypes`                      | `string[]` | No       | `["research"]` | The available agent types that can be used for research (see [Agent Types](#agent-types)) |

Agents may override `researchDirectory` via their own `research.researchDirectory`
agent config slice.

### Schema Metadata

The `ResearchServiceConfigSchema` includes `.meta()` annotations for configuration
UI integration:

- **Top-level**: label `"Research"`, description `"Topic-based research dossiers,
  backed by markdown files on disk"`
- **`agentDefaults`**: label `"Agent Defaults"`
- **`researchDirectory`**: description `"Directory where research topics are stored"`
- **`agentTypes`**: description `"The available agent types that can be used for
  research"`

### Agent Types

The package ships one agent type via `config/agents/research.yaml`, referenced by the default
`agentTypes` value:

| Field         | Value                                                                  |
|---------------|------------------------------------------------------------------------|
| Name          | `research`                                                             |
| Display name  | `Deep Research`                                                        |
| Category      | `Research`                                                             |
| Description   | Multi-file deep research reports using web search, todos, and research topic tools. |
| Enabled tools | `websearch_*`, `todo`, `topic_*`, `item_*`, `file_*`                   |
| Enabled hooks | `addSelectedItem`                                                      |

The agent's system prompt instructs it to create a slug-named topic per research project, plan the
work with todos, gather verified web sources with citations, and write markdown items (`summary`,
`toc`, and one deep-dive item per major section) via the research tools. The agent config also
defines the `/deep research` chat command and the `deep_research` config-defined tool.

### Exported Schemas

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

| Schema                       | Description                                                        |
|------------------------------|--------------------------------------------------------------------|
| `ResearchServiceConfigSchema`| Plugin-level configuration                                          |
| `ResearchAgentConfigSchema`  | Per-agent configuration override                                    |
| `TopicSummarySchema`         | Topic metadata (`name`, `itemCount`, `updatedAt`)                  |
| `ItemSummarySchema`          | Item metadata (`topicName`, `name`, `size`, `updatedAt`)           |
| `ItemSchema`                 | Full item including `content`                                       |

The corresponding types (`TopicSummary`, `ItemSummary`, `Item`, `ResearchAgentConfig`,
`ResearchServiceConfig`, and `ParsedResearchConfig`) are exported alongside the schemas.

## Naming

Topic and item names must start with a letter or number and may only contain letters,
numbers, hyphens, and underscores (`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`). An item named
`summary` in a topic named `solid-state-batteries` is stored at
`solid-state-batteries/summary.md` in the research directory.

## Core Components

### ResearchService

The central service that manages research topics and markdown items on disk.

```typescript
import { ResearchService } from "@tokenring-ai/research";

const researchService = app.requireService(ResearchService);
```

#### Directory and State Methods

| Method | Description |
|--------|-------------|
| `getAgentTypes()` | Return the agent types configured for research (from `ResearchServiceConfigSchema.agentTypes`) |
| `getDefaultResearchDirectory()` | Return the application default research directory |
| `getResearchDirectory(agent)` | Return the active agent's research directory |
| `getCurrentItem(agent)` | Return the agent's currently selected item, or `undefined` |
| `selectItem(topicName, itemName, agent)` | Load an item and set it as the agent's current selection; returns the item or `null` |
| `clearCurrentItem(agent)` | Clear the agent's currently selected item |

#### Topic Methods

| Method | Description |
|--------|-------------|
| `listTopics(root)` | List topic summaries (`name`, `itemCount`, `updatedAt`), sorted by name |
| `createTopic(root, topicName)` | Create a new, empty topic; throws if the name is already in use |
| `deleteTopic(root, topicName)` | Delete a topic and all of its items; returns `false` if it didn't exist |

#### Item Methods

| Method | Description |
|--------|-------------|
| `listItems(root, topicName)` | List item summaries (`topicName`, `name`, `size`, `updatedAt`) within a topic, sorted by name |
| `getItem(root, topicName, itemName)` | Read an item's content, or `null` if it doesn't exist |
| `createItem(root, topicName, itemName, content)` | Create a new item, auto-creating its topic; throws if the name is already in use |
| `updateItem(root, topicName, itemName, content)` | Create or overwrite an item, auto-creating its topic |
| `deleteItem(root, topicName, itemName)` | Delete an item; returns `false` if it didn't exist |
| `renameItem(root, fromTopic, fromName, toTopic, toName)` | Move / rename an item, creating the target topic; throws if the target exists or the source is missing |
| `searchItems(root, query, { topicName?, limit? })` | Case-insensitive search over item names, first-heading titles and content; title matches first, then by match count (default limit 50) |
| `exportTopic(root, topicName)` | Concatenate every item of a topic into one Markdown document (`{ fileName, content, itemCount }`) |

### ResearchState

Agents maintain a `ResearchState` instance that holds the active research directory
and selected item.

```typescript
import { ResearchState } from "@tokenring-ai/research";

const state = agent.getState(ResearchState);
console.log(state.researchDirectory);
console.log(state.currentItem?.topicName);
```

| Property               | Type                                       | Description                                                     |
|------------------------|--------------------------------------------|-----------------------------------------------------------------|
| `initialConfig`        | `ParsedResearchConfig["agentDefaults"]`    | The agent defaults the state was initialized with (readonly)    |
| `researchDirectory`    | `string`                                   | The agent's configured research directory                       |
| `currentItem`      | `Item \| undefined` | The currently selected research item                             |
| `lastAttachedItemId`| `string \| undefined` | ID of the last item attached to chat (prevents duplicate attachments) |

#### State Inheritance

`ResearchState` implements `transferStateFromParent`. When a child agent is created,
it inherits the parent's `currentItem` if the child does not already have one.

#### State Serialization

`ResearchState` supports serialization and deserialization for session persistence:

- `serialize()` — Returns `{ researchDirectory, currentItem?, lastAttachedItemId? }`
- `deserialize(data)` — Restores all properties from serialized data
- `show()` — Returns a human-readable summary string

## Services / Lifecycle Methods

`ResearchService` implements the `TokenRingService` interface. The plugin registers it and wires
the rest of its surface through `waitForService`:

```typescript
app.addService(ResearchService, new ResearchService());
app.waitForService(AgentLifecycleService, lifecycleService => lifecycleService.addHooks(addSelectedItem));
app.waitForService(ChatService, chatService => chatService.addTools(tools));
app.waitForService(RpcService, rpcService => {
  rpcService.registerEndpoint(researchRPC);
});
```

### Plugin Lifecycle

The plugin (`plugin/research/plugin.ts`) defines `install` and `reconfigure`:

| Field          | Value                                             |
|----------------|---------------------------------------------------|
| `name`         | `@tokenring-ai/research`                          |
| `displayName`  | `Research`                                        |
| `version`      | package version                                   |
| `description`  | package description                               |
| `configSchema` | `z.object({ research: ResearchServiceConfigSchema })` |

**`install(app)`:**

1. Adds `ResearchService` to the app.
2. When `AgentLifecycleService` becomes available, registers the `addSelectedItem` hook.
3. When `ChatService` becomes available, registers the seven research tools.
4. When `RpcService` becomes available, registers the `/rpc/research` endpoint.

**`reconfigure(app, config)`:**

Calls `app.requireService(ResearchService).reconfigure(config.research)`, which replaces the
service configuration (agent defaults and agent types).

### Service Lifecycle Methods

| Method | Description |
|--------|-------------|
| `attach(agent, creationContext)` | Initialize `ResearchState` on the agent from `agentDefaults` merged with the agent's `research` config slice; adds the research directory to the creation context items |
| `reconfigure(options)` | Update the service configuration at runtime |

During `attach`, the agent config slice is resolved by merging the service-level
`agentDefaults` with the per-agent `research.researchDirectory` override.

## Lifecycle Hooks

The package registers one lifecycle hook via `AgentLifecycleService`.

### addSelectedItem

- **Name**: `addSelectedItem`
- **Display Name**: `Research/Add currently selected item to chat`
- **Description**: Attaches the currently selected research markdown item to the chat
  message
- **Triggered by**: `BeforeInputReceived`

When a user sends a new message, this hook checks the agent's
`ResearchState.currentItem`. If an item is selected and has not already been attached
(tracked via `lastAttachedItemId`), it appends a markdown attachment to the message:

```typescript
{
  name: "<topicName>/<itemName>.md",
  description: "The markdown below is the currently selected research item.",
  encoding: "text",
  mimeType: "text/markdown",
  body: item.content,
}
```

This ensures the agent always has the currently open research dossier item in context
when responding.

## RPC

The plugin registers a `Research RPC` endpoint at `/rpc/research` with the following
methods:

| Method               | Type      | Description                                            |
|----------------------|-----------|--------------------------------------------------------|
| `getResearchConfiguration` | query | Get research configuration (`agentTypes`)              |
| `listTopics`         | query     | List all topics                                        |
| `streamTopics`       | stream    | Polling stream of topics (3s interval)                 |
| `createTopic`        | mutation  | Create a new topic                                     |
| `deleteTopic`        | mutation  | Delete a topic and its items                           |
| `listItems`          | query     | List items within a topic                              |
| `streamItems`        | stream    | Polling stream of items (3s interval)                  |
| `getItem`            | query     | Read an item's content                                 |
| `createItem`         | mutation  | Create a new item                                      |
| `updateItem`         | mutation  | Create or overwrite an item                            |
| `deleteItem`         | mutation  | Delete an item                                         |
| `renameItem`         | mutation  | Move / rename an item (`newTopicName`, `newName`); agents with it selected follow it |
| `searchItems`        | query     | Search all topics (or one via `topicName`); returns `title`, `titleMatch`, `contentMatches`, `snippet` per result |
| `exportTopic`        | query     | A topic's items concatenated as one Markdown document  |
| `getResearchState`   | query     | Get an agent's currently selected topic and item       |
| `updateResearchState`| mutation  | Set an agent's currently selected topic and item       |

The `createItem` method's `content` input is optional and defaults to an empty
string; `updateItem` requires `content` to be provided.

### State Management Methods

`getResearchState` and `updateResearchState` return a discriminated union on
`status`:

| Status           | Additional Fields                                          | Description                                    |
|------------------|------------------------------------------------------------|------------------------------------------------|
| `"success"`      | `selectedTopicName: string \| null`, `selectedItemName: string \| null` | Agent found and state returned |
| `"agentNotFound"`| _(none)_                                                   | The specified `agentId` does not match an active agent |

`updateResearchState` accepts `selectedTopicName` and `selectedItemName` as optional inputs. The
selection is only changed when both are provided; otherwise the agent's current selection is left
unchanged and returned.

### Streaming Methods

`streamTopics` and `streamItems` are polling streams that re-query the directory every
3 seconds, yielding updated topic or item lists. They are created via
`createPollingQueryStream`.

## Dependencies

| Package                    | Purpose                                         |
|----------------------------|-------------------------------------------------|
| `@tokenring-ai/agent`      | Agent state management and lifecycle hooks      |
| `@tokenring-ai/app`        | Plugin interface and configuration metadata     |
| `@tokenring-ai/chat`       | Tool registration with ChatService              |
| `@tokenring-ai/lifecycle`  | Lifecycle hook registration                     |
| `@tokenring-ai/rpc`        | RPC endpoint and streaming query support        |
| `@tokenring-ai/utility`    | Deep clone utility for config merging           |
| `zod`                      | Schema validation                               |

## Testing

Tests use `bun test` and are located in `ResearchService.test.ts`.

```bash
bun test             # Run tests
bun test --watch     # Watch mode
bun test --coverage  # Coverage report
```

The test suite covers topic and item creation (including duplicate-creation errors), item
read/update/delete, topic deletion, auto-vivification of topics by `createItem`, name
validation, `.md`-only listing with name sorting and item counts, and missing-directory
handling.

## License

MIT License — see LICENSE file for details.
