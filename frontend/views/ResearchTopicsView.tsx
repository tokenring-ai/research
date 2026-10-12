import AgentSessionList from "@tokenring-ai/one-frontend/components/AgentSessionList.tsx";
import AgentTodoList from "@tokenring-ai/one-frontend/components/AgentTodoList.tsx";
import NavigationSidebarHeader from "@tokenring-ai/one-frontend/components/layout/NavigationSidebarHeader.tsx";
import AsyncListBody from "@tokenring-ai/one-frontend/components/ui/AsyncListBody.tsx";
import ConfirmModal from "@tokenring-ai/one-frontend/components/ui/ConfirmModal.tsx";
import CreateItemModal from "@tokenring-ai/one-frontend/components/ui/CreateItemModal.tsx";
import ErrorBanner from "@tokenring-ai/one-frontend/components/ui/ErrorBanner.tsx";
import ListItemWithActions from "@tokenring-ai/one-frontend/components/ui/ListItemWithActions.tsx";
import SaveAsModal from "@tokenring-ai/one-frontend/components/ui/SaveAsModal.tsx";
import SearchInput from "@tokenring-ai/one-frontend/components/ui/SearchInput.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { usePanel } from "@tokenring-ai/one-frontend/dock/PanelContext.tsx";
import { useAgentChatPanel } from "@tokenring-ai/one-frontend/dock/useAgentChatPanel.ts";
import { useAppAgentSession } from "@tokenring-ai/one-frontend/hooks/useAppAgentSession.tsx";
import { useAutoExpandTree } from "@tokenring-ai/one-frontend/hooks/useAutoExpandTree.ts";
import { toastOnReject } from "@tokenring-ai/one-frontend/lib/toastOnReject.ts";
import { downloadTextFile } from "@tokenring-ai/one-frontend/lib/transcriptExport.ts";
import { runOrConfirm } from "@tokenring-ai/one-frontend/lib/uiPreferences.ts";
import { agentRPCClient, researchRPCClient, useItems, useResearchConfiguration, useTopics } from "@tokenring-ai/one-frontend/rpc.ts";
import type { ItemSearchResult, ItemSummary, TopicSummary } from "@tokenring-ai/research/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { formatBytes } from "@tokenring-ai/utility/number/formatBytes";
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, FolderOpen, Plus, SearchX, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DEFAULT_MARKDOWN, NAME_PATTERN } from "../lib/paths.ts";
import { useResearchNavigation } from "../lib/researchShared.tsx";
import { setItemDraft, setResearchAgentSession } from "../lib/researchStore.ts";
import { RESEARCH_DASHBOARD_ID } from "../manifest.ts";

interface Selection {
  topicName: string;
  itemName: string;
}

/** One topic and, while expanded, the dossiers inside it (live, so agent writes show up). */
function TopicRow({
  topic,
  expanded,
  onToggle,
  selected,
  onSelectItem,
  onNewItem,
  onDeleteItem,
  onDeleteTopic,
  onExportTopic,
}: {
  topic: TopicSummary;
  expanded: boolean;
  onToggle: () => void;
  selected: Selection | null;
  onSelectItem: (topicName: string, itemName: string) => void;
  onNewItem: (topicName: string) => void;
  onDeleteItem: (topicName: string, itemName: string) => void;
  onDeleteTopic: (topicName: string) => void;
  onExportTopic: (topicName: string) => void;
}) {
  const { data, isLoading, error, mutate } = useItems(expanded ? topic.name : null);
  const items: ItemSummary[] | null = data?.items ?? null;

  useEffect(() => {
    if (error) toastManager.error(formatError(error), { duration: 4000 });
  }, [error]);

  return (
    <div className="border-b border-primary/50">
      <ListItemWithActions
        id={`topic:${topic.name}`}
        onPrimary={onToggle}
        className="gap-1.5 px-2 py-2 rounded-none"
        action={
          <>
            <button
              type="button"
              onClick={() => onNewItem(topic.name)}
              aria-label={`New item in ${topic.name}`}
              className="p-0.5 text-muted hover:text-primary rounded transition-opacity cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onExportTopic(topic.name)}
              title="Export topic as Markdown"
              aria-label={`Export topic ${topic.name}`}
              className="p-0.5 text-muted hover:text-primary rounded transition-opacity cursor-pointer"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteTopic(topic.name)}
              title="Delete topic"
              aria-label={`Delete topic ${topic.name}`}
              className="p-0.5 text-muted hover:text-red-500 rounded transition-opacity cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        }
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
          <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={topic.name}>
            {topic.name}
          </span>
          <span className="text-xs text-muted shrink-0">{topic.itemCount}</span>
        </span>
      </ListItemWithActions>

      {expanded && (
        <div className="pl-5">
          <AsyncListBody
            variant="nested"
            isLoading={isLoading}
            error={error}
            onRetry={() => void mutate()}
            hasItems={(items?.length ?? 0) > 0}
            errorTitle="Failed to load items"
            emptyIcon={FileText}
            emptyTitle="No items yet"
          >
            {items?.map(item => {
              const isSelected = selected?.topicName === topic.name && selected.itemName === item.name;
              return (
                <ListItemWithActions
                  key={item.name}
                  id={`item:${topic.name}/${item.name}`}
                  selected={isSelected}
                  onPrimary={() => onSelectItem(topic.name, item.name)}
                  className={`gap-1.5 px-2 py-1.5 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
                  action={
                    <>
                      <span className="text-xs text-muted shrink-0 tabular-nums">{formatBytes(item.size)}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(topic.name, item.name)}
                        title="Delete item"
                        aria-label={`Delete item ${item.name}`}
                        className="p-0.5 text-muted hover:text-red-500 rounded transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  }
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate text-xs" title={item.name}>
                      {item.name}
                    </span>
                  </span>
                </ListItemWithActions>
              );
            })}
          </AsyncListBody>
        </div>
      )}
    </div>
  );
}

const SEARCH_DEBOUNCE_MS = 250;

/** Case-insensitive search across every topic's dossiers (names, title headings and content). */
function SearchResults({
  query,
  selected,
  onSelectItem,
}: {
  query: string;
  selected: Selection | null;
  onSelectItem: (topicName: string, itemName: string) => void;
}) {
  const [results, setResults] = useState<ItemSearchResult[] | null>(null);
  const [error, setError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    const timer = setTimeout(() => {
      researchRPCClient
        .searchItems({ query })
        .then(({ results: next }) => {
          if (!cancelled) setResults(next);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  return (
    <AsyncListBody
      isLoading={results === null && !error}
      error={error}
      onRetry={() => setAttempt(n => n + 1)}
      hasItems={(results?.length ?? 0) > 0}
      loadingMessage="Searching…"
      errorTitle="Search failed"
      emptyIcon={SearchX}
      emptyTitle="No matching dossiers"
    >
      <ul aria-label="Search results">
        {results?.map(result => {
          const isSelected = selected?.topicName === result.topicName && selected.itemName === result.name;
          return (
            <li key={`${result.topicName}/${result.name}`} className="border-b border-primary/50">
              <button
                type="button"
                onClick={() => onSelectItem(result.topicName, result.name)}
                className={`w-full text-left px-2 py-1.5 cursor-pointer focus-ring hover:bg-hover ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <FileText className="w-3 h-3 shrink-0 opacity-70" />
                  <span className="flex-1 min-w-0 truncate text-xs font-medium" title={result.title ?? result.name}>
                    {result.name}
                  </span>
                  {result.titleMatch && <span className="shrink-0 text-[10px] uppercase tracking-wide text-accent">title</span>}
                  {result.contentMatches > 0 && (
                    <span className="shrink-0 text-[10px] text-muted tabular-nums">
                      {result.contentMatches} {result.contentMatches === 1 ? "match" : "matches"}
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-muted truncate">{result.topicName}</span>
                <span className="block text-[11px] text-secondary line-clamp-2">{result.snippet}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </AsyncListBody>
  );
}

/**
 * The research agents this dashboard can attach to. Owns the only
 * `useAppAgentSession` of the app: it docks the chat panel beside the topics
 * and publishes a `start` hook the landing panel uses for its prompt.
 */
function ResearchAgentSessions({ selected, onAgentChange }: { selected: Selection | null; onAgentChange: (agentId: string | null) => void }) {
  const configuration = useResearchConfiguration();
  const allowedAgentTypes = configuration.data?.agentTypes ?? ["research"];
  const { agentId, agents, isLoading, selectAgent, createAgent, terminateAgent, TerminateDialog } = useAppAgentSession({
    appName: "Research dashboard",
    storageKey: "research",
    agentTypes: allowedAgentTypes,
  });
  useAgentChatPanel({ agentId });

  useEffect(() => {
    onAgentChange(agentId);
  }, [agentId, onAgentChange]);

  // Keep the agent's current dossier in sync so it can attach the open item to chat input.
  useEffect(() => {
    if (!agentId || !selected) return;
    toastOnReject(
      researchRPCClient.updateResearchState({
        agentId,
        selectedTopicName: selected.topicName,
        selectedItemName: selected.itemName,
      }),
    );
  }, [agentId, selected]);

  const start = useCallback(
    async (query: string): Promise<boolean> => {
      // Reuse the attached agent so a second prompt continues the same conversation.
      const id = agentId ?? (await createAgent());
      if (!id) return false;
      try {
        const result = await agentRPCClient.sendInput({ agentId: id, input: { from: "Research app", message: `/deep research ${query}` } });
        if (result.status === "agentNotFound") {
          toastManager.error("Research agent is no longer available", { duration: 5000 });
          return false;
        }
        return true;
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
        return false;
      }
    },
    [agentId, createAgent],
  );

  // Published for the landing panel, which must not own a competing session.
  useEffect(() => {
    setResearchAgentSession({ agentId, start });
    return () => setResearchAgentSession(null);
  }, [agentId, start]);

  return (
    <>
      <AgentSessionList
        storageKey="research"
        agents={agents}
        selectedAgentId={agentId}
        isLoading={isLoading}
        label="Research agents"
        onSelect={selectAgent}
        onCreate={() => void createAgent()}
        onTerminate={id => void terminateAgent(id)}
      />
      {agentId && <AgentTodoList agentId={agentId} agentName="research agent" className="mx-2 mb-1.5 ml-7 border-t border-primary/40 pt-1.5" />}
      <TerminateDialog />
    </>
  );
}

/**
 * Navigator for the Research dashboard: topics, the dossiers inside them and
 * the running research agents. Rows open dossiers in the main area; elsewhere
 * (another dashboard) they navigate to the Research dashboard.
 */
export default function ResearchTopicsView() {
  const panel = usePanel();
  const inResearchDashboard = panel.dashboardId === RESEARCH_DASHBOARD_ID;
  const { topicName: routeTopicName, itemName: routeItemName } = useParams<{ topicName?: string; itemName?: string }>();
  const selected: Selection | null = useMemo(
    () => (routeTopicName && routeItemName ? { topicName: routeTopicName, itemName: routeItemName } : null),
    [routeTopicName, routeItemName],
  );

  const { data, isLoading, error, mutate } = useTopics();
  const topics: TopicSummary[] = data?.topics ?? [];
  const { openItem, closeItem, closeTopic } = useResearchNavigation();
  const navigate = useNavigate();
  // Explicitly false only: an unknown (loading) configuration shows no banner.
  const searchProviderMissing = useResearchConfiguration().data?.searchProviderAvailable === false;

  const [agentId, setAgentId] = useState<string | null>(null);
  const [newItemTopic, setNewItemTopic] = useState<string | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<Selection | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();

  // Topics gaining items while an agent runs open themselves; manual collapses are honoured.
  const { expandedKeys, toggle, expand, collapse } = useAutoExpandTree({
    items: topics,
    getKey: (topic: TopicSummary) => topic.name,
    getCount: (topic: TopicSummary) => topic.itemCount,
    agentId,
    respectUserCollapse: true,
  });

  useEffect(() => {
    if (routeTopicName) expand(routeTopicName);
  }, [routeTopicName, expand]);

  useEffect(() => {
    if (error) toastManager.error(formatError(error), { duration: 4000 });
  }, [error]);

  const handleCreateItem = useCallback(
    async (topicName: string, itemName: string) => {
      try {
        const { item } = await researchRPCClient.createItem({ topicName, name: itemName, content: DEFAULT_MARKDOWN });
        setNewItemTopic(null);
        expand(item.topicName);
        openItem(item.topicName, item.name);
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [expand, openItem],
  );

  const handleCreateTopic = useCallback(async (name: string) => {
    try {
      await researchRPCClient.createTopic({ name });
      setNewTopicOpen(false);
      toastManager.success("Topic created", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    }
  }, []);

  const handleDeleteItem = useCallback(
    async (topicName: string, itemName: string) => {
      try {
        const { success } = await researchRPCClient.deleteItem({ topicName, name: itemName });
        // A failed delete keeps the dossier, its draft and its panels.
        if (!success) throw new Error(`Could not delete "${itemName}"`);
        setItemDraft(`${topicName}/${itemName}`, null);
        setDeleteItemTarget(null);
        closeItem(topicName, itemName);
        toastManager.success("Deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [closeItem],
  );

  const handleDeleteTopic = useCallback(
    async (topicName: string) => {
      try {
        const { success } = await researchRPCClient.deleteTopic({ name: topicName });
        if (!success) throw new Error(`Could not delete topic "${topicName}"`);
        collapse(topicName);
        setDeleteTopicTarget(null);
        // Every open dossier of the topic goes, not just the one in the URL.
        closeTopic(topicName);
        toastManager.success("Topic deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [closeTopic, collapse],
  );

  const handleExportTopic = useCallback(async (topicName: string) => {
    try {
      const { fileName, content, itemCount } = await researchRPCClient.exportTopic({ topicName });
      downloadTextFile(fileName, content, "text/markdown");
      toastManager.success(`Exported ${itemCount} ${itemCount === 1 ? "dossier" : "dossiers"}`, { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    }
  }, []);

  const body = trimmedQuery ? (
    <SearchResults query={trimmedQuery} selected={selected} onSelectItem={openItem} />
  ) : (
    <AsyncListBody
      isLoading={isLoading}
      error={error}
      onRetry={() => void mutate()}
      hasItems={topics.length > 0}
      loadingMessage="Loading topics…"
      errorTitle="Failed to load topics"
      emptyIcon={BookOpen}
      emptyTitle="No topics yet"
      emptyHint="Start a research agent or create a topic"
    >
      {topics.map(topic => (
        <TopicRow
          key={topic.name}
          topic={topic}
          expanded={expandedKeys.has(topic.name)}
          onToggle={() => toggle(topic.name)}
          selected={selected}
          onSelectItem={openItem}
          onNewItem={name => setNewItemTopic(name)}
          onDeleteItem={(topicName, itemName) =>
            runOrConfirm(
              "Delete item?",
              () => setDeleteItemTarget({ topicName, itemName }),
              () => void handleDeleteItem(topicName, itemName),
            )
          }
          onExportTopic={name => void handleExportTopic(name)}
          onDeleteTopic={name =>
            runOrConfirm(
              "Delete topic?",
              () => setDeleteTopicTarget(name),
              () => void handleDeleteTopic(name),
            )
          }
        />
      ))}
    </AsyncListBody>
  );

  return (
    <ViewShell
      tone="sidebar"
      scroll={false}
      header={
        <NavigationSidebarHeader
          title="Topics"
          actions={[
            { icon: <FileText className="w-3.5 h-3.5" />, label: "New research item", title: "New research item", onClick: () => setNewItemTopic("") },
            { icon: <Plus className="w-3.5 h-3.5" />, label: "New topic", title: "New topic", onClick: () => setNewTopicOpen(true) },
          ]}
        />
      }
    >
      {searchProviderMissing && (
        <ErrorBanner
          title="No web search provider"
          message="Research agents can't search the web until a search provider is configured."
          action={{ label: "Configure", onClick: () => void navigate("/configuration") }}
          data-testid="research-search-provider-banner"
        />
      )}
      {inResearchDashboard && <ResearchAgentSessions selected={selected} onAgentChange={setAgentId} />}

      <div className="shrink-0 px-2 py-1.5 border-b border-primary/50">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search dossiers…" aria-label="Search research" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{body}</div>

      {newItemTopic !== null && (
        <SaveAsModal
          title="New Research Item"
          containerField={{
            label: "Topic",
            placeholder: "solid-state-batteries",
            initialValue: newItemTopic || (selected?.topicName ?? ""),
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: topics.map(topic => ({ value: topic.name })),
          }}
          itemField={{
            label: "Item name",
            placeholder: "summary",
            initialValue: "",
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: [],
            autoFocus: true,
            selectOnFocus: true,
          }}
          onSave={handleCreateItem}
          onClose={() => setNewItemTopic(null)}
        />
      )}
      {newTopicOpen && (
        <CreateItemModal
          title="New Topic"
          placeholder="solid-state-batteries"
          pattern={NAME_PATTERN}
          validationError="Use letters, numbers, hyphens, and underscores only, starting with a letter or number."
          onCreate={handleCreateTopic}
          onClose={() => setNewTopicOpen(false)}
        />
      )}
      {deleteItemTarget && (
        <ConfirmModal
          title="Delete item?"
          message={`This will permanently delete "${deleteItemTarget.itemName}" from topic "${deleteItemTarget.topicName}".`}
          onConfirm={() => handleDeleteItem(deleteItemTarget.topicName, deleteItemTarget.itemName)}
          onClose={() => setDeleteItemTarget(null)}
        />
      )}
      {deleteTopicTarget && (
        <ConfirmModal
          title="Delete topic?"
          message={`This will permanently delete the topic "${deleteTopicTarget}" and all of its items.`}
          onConfirm={() => handleDeleteTopic(deleteTopicTarget)}
          onClose={() => setDeleteTopicTarget(null)}
        />
      )}
    </ViewShell>
  );
}
