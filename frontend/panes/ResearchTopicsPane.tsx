import { useAttachedAgentChat } from "@tokenring-ai/one-frontend/apps/chat/useAttachedAgentChat.ts";
import { useRouteParamsFor } from "@tokenring-ai/one-frontend/apps/panelHooks.ts";
import AgentSessionList from "@tokenring-ai/one-frontend/components/AgentSessionList.tsx";
import AgentTodoList from "@tokenring-ai/one-frontend/components/AgentTodoList.tsx";
import NavigationSidebarHeader from "@tokenring-ai/one-frontend/components/layout/NavigationSidebarHeader.tsx";
import AsyncListBody from "@tokenring-ai/one-frontend/components/ui/AsyncListBody.tsx";
import ConfirmModal from "@tokenring-ai/one-frontend/components/ui/ConfirmModal.tsx";
import CreateItemModal from "@tokenring-ai/one-frontend/components/ui/CreateItemModal.tsx";
import ErrorBanner from "@tokenring-ai/one-frontend/components/ui/ErrorBanner.tsx";
import InlineDropdown, { InlineDropdownItem } from "@tokenring-ai/one-frontend/components/ui/InlineDropdown.tsx";
import ListItemWithActions from "@tokenring-ai/one-frontend/components/ui/ListItemWithActions.tsx";
import SaveAsModal from "@tokenring-ai/one-frontend/components/ui/SaveAsModal.tsx";
import SearchInput from "@tokenring-ai/one-frontend/components/ui/SearchInput.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useAppAgentSession } from "@tokenring-ai/one-frontend/hooks/useAppAgentSession.tsx";
import { useAutoExpandTree } from "@tokenring-ai/one-frontend/hooks/useAutoExpandTree.ts";
import { toastOnReject } from "@tokenring-ai/one-frontend/lib/toastOnReject.ts";
import { downloadTextFile } from "@tokenring-ai/one-frontend/lib/transcriptExport.ts";
import { runOrConfirm } from "@tokenring-ai/one-frontend/lib/uiPreferences.ts";
import { agentRPCClient, researchRPCClient, useItems, useResearchConfiguration, useTopics } from "@tokenring-ai/one-frontend/rpc.ts";
import type { ItemSearchResult, ItemSummary, TopicSummary } from "@tokenring-ai/research/schema";
import { filterTopicsByTags, matchTopics, parseTagInput } from "@tokenring-ai/research/tags";
import formatError from "@tokenring-ai/utility/error/formatError";
import { formatBytes } from "@tokenring-ai/utility/number/formatBytes";
import { BookOpen, ChevronDown, ChevronRight, Download, FileDown, FileText, FolderOpen, Link2, Plus, SearchX, Tag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RESEARCH_ITEM_VIEW_ID, RESEARCH_TOPIC_VIEW_ID } from "../ids.ts";
import { downloadBase64File } from "../lib/download.ts";
import { DEFAULT_MARKDOWN, NAME_PATTERN } from "../lib/paths.ts";
import { setItemDraft, setResearchAgentSession } from "../lib/researchStore.ts";
import { useResearchLayoutNavigation } from "../lib/useResearchLayoutNavigation.ts";

/** What the Export menu can do with a brief. */
type BriefAction = "md" | "docx" | "pdf" | "copy";

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
  onExportBrief,
  briefBusy,
  onEditTags,
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
  onExportBrief: (topicName: string, format: BriefAction) => void;
  /** True while this topic's brief is being built. */
  briefBusy: boolean;
  onEditTags: (topic: TopicSummary) => void;
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
              onClick={() => onEditTags(topic)}
              title="Edit tags (client or project)"
              aria-label={`Set tags for ${topic.name}`}
              className="p-0.5 text-muted hover:text-primary rounded transition-opacity cursor-pointer"
            >
              <Tag className="w-3 h-3" />
            </button>
            <InlineDropdown
              aria-label={`Export brief for ${topic.name}`}
              align="right"
              width="w-44"
              closeOnSelect
              disabled={briefBusy}
              triggerClassName="p-0.5 px-0.5 py-0.5 bg-transparent border-0"
              trigger={briefBusy ? <span className="text-[10px]">Exporting…</span> : <FileDown className="w-3 h-3" />}
            >
              <InlineDropdownItem onClick={() => onExportBrief(topic.name, "md")}>Markdown (.md)</InlineDropdownItem>
              <InlineDropdownItem onClick={() => onExportBrief(topic.name, "docx")}>Word (.docx)</InlineDropdownItem>
              <InlineDropdownItem onClick={() => onExportBrief(topic.name, "pdf")}>PDF (.pdf)</InlineDropdownItem>
              <InlineDropdownItem onClick={() => onExportBrief(topic.name, "copy")}>Copy Markdown</InlineDropdownItem>
            </InlineDropdown>
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
        {topic.tags.length > 0 && (
          <span className="flex flex-wrap gap-1 pl-6 pt-0.5" role="group" aria-label={`Tags of ${topic.name}`}>
            {topic.tags.map(tag => (
              <span key={tag} className="rounded-full border border-primary/60 px-1.5 text-[10px] leading-4 text-muted">
                {tag}
              </span>
            ))}
          </span>
        )}
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
                    {item.sourceCount > 0 && (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted tabular-nums"
                        title={`${item.sourceCount} ${item.sourceCount === 1 ? "source" : "sources"}`}
                        role="img"
                        aria-label={`${item.sourceCount} ${item.sourceCount === 1 ? "source" : "sources"}`}
                      >
                        <Link2 className="w-2.5 h-2.5" aria-hidden="true" />
                        {item.sourceCount}
                      </span>
                    )}
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
 * The research agents this app can attach to. Owns the only
 * `useAppAgentSession` of the app: it keeps the chat beside the dossiers
 * and publishes a `start` hook the landing tab uses for its prompt.
 */
function ResearchAgentSessions({ selected, onAgentChange }: { selected: Selection | null; onAgentChange: (agentId: string | null) => void }) {
  const configuration = useResearchConfiguration();
  const allowedAgentTypes = configuration.data?.agentTypes ?? ["research"];
  const { agentId, agents, isLoading, selectAgent, createAgent, terminateAgent, TerminateDialog } = useAppAgentSession({
    appName: "Research dashboard",
    storageKey: "research",
    agentTypes: allowedAgentTypes,
  });
  // Keeps the attached agent's chat beside the dossiers.
  useAttachedAgentChat({ agentId });

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
 * Navigator for the Research app: topics, the dossiers inside them and the
 * running research agents. Rows open dossiers as tabs.
 */
export default function ResearchTopicsPane() {
  const itemRoute = useRouteParamsFor(RESEARCH_ITEM_VIEW_ID);
  const topicRoute = useRouteParamsFor(RESEARCH_TOPIC_VIEW_ID);
  const routeTopicName = itemRoute?.topicName ?? topicRoute?.topicName;
  const routeItemName = itemRoute?.itemName;
  const selected: Selection | null = useMemo(
    () => (routeTopicName && routeItemName ? { topicName: routeTopicName, itemName: routeItemName } : null),
    [routeTopicName, routeItemName],
  );

  const { data, isLoading, error, mutate } = useTopics();
  const topics: TopicSummary[] = data?.topics ?? [];
  const { openItem, closeItem, closeTopic } = useResearchLayoutNavigation();
  const navigate = useNavigate();
  // Explicitly false only: an unknown (loading) configuration shows no banner.
  const searchProviderMissing = useResearchConfiguration().data?.searchProviderAvailable === false;

  const [agentId, setAgentId] = useState<string | null>(null);
  const [newItemTopic, setNewItemTopic] = useState<string | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<Selection | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<string | null>(null);
  const [tagEditTarget, setTagEditTarget] = useState<TopicSummary | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
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

  const [briefBusyTopic, setBriefBusyTopic] = useState<string | null>(null);
  const handleExportBrief = useCallback(async (topicName: string, action: BriefAction) => {
    setBriefBusyTopic(topicName);
    try {
      const result = await researchRPCClient.exportBrief({ topicName, format: action === "copy" ? "md" : action });
      const summary = `${result.itemCount} ${result.itemCount === 1 ? "dossier" : "dossiers"}, ${result.sourceCount} ${result.sourceCount === 1 ? "reference" : "references"}`;
      if ("contentBase64" in result) {
        downloadBase64File(result.fileName, result.mimeType, result.contentBase64);
        toastManager.success(`Exported brief: ${summary}`, { duration: 2000 });
        if (result.warnings.length > 0) toastManager.warning(result.warnings.join(" "), { duration: 10000 });
      } else if (action === "copy") {
        await navigator.clipboard.writeText(result.content);
        toastManager.success(`Copied brief as Markdown: ${summary}`, { duration: 2000 });
      } else {
        downloadTextFile(result.fileName, result.content, "text/markdown");
        toastManager.success(`Exported brief: ${summary}`, { duration: 2000 });
      }
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setBriefBusyTopic(null);
    }
  }, []);

  const handleSaveTags = useCallback(
    async (text: string) => {
      if (!tagEditTarget) return;
      await researchRPCClient.setTopicTags({ name: tagEditTarget.name, tags: parseTagInput(text) });
      setTagEditTarget(null);
      toastManager.success("Tags saved", { duration: 2000 });
    },
    [tagEditTarget],
  );

  const toggleTag = useCallback((tag: string) => {
    setActiveTags(current => (current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]));
  }, []);

  const allTags = useMemo(() => [...new Set([...topics.flatMap(topic => topic.tags), ...activeTags])].sort(), [topics, activeTags]);
  const visibleTopics = useMemo(() => filterTopicsByTags(topics, activeTags), [topics, activeTags]);
  const matchedTopics = useMemo(() => matchTopics(topics, trimmedQuery), [topics, trimmedQuery]);

  const renderTopicRow = (topic: TopicSummary) => (
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
      onExportBrief={(name, action) => void handleExportBrief(name, action)}
      briefBusy={briefBusyTopic === topic.name}
      onEditTags={setTagEditTarget}
      onDeleteTopic={name =>
        runOrConfirm(
          "Delete topic?",
          () => setDeleteTopicTarget(name),
          () => void handleDeleteTopic(name),
        )
      }
    />
  );

  const body = trimmedQuery ? (
    <>
      {matchedTopics.length > 0 && (
        <div role="group" aria-label="Matching topics">
          {matchedTopics.map(renderTopicRow)}
        </div>
      )}
      <SearchResults query={trimmedQuery} selected={selected} onSelectItem={openItem} />
    </>
  ) : (
    <AsyncListBody
      isLoading={isLoading}
      error={error}
      onRetry={() => void mutate()}
      hasItems={visibleTopics.length > 0}
      loadingMessage="Loading topics…"
      errorTitle="Failed to load topics"
      emptyIcon={BookOpen}
      emptyTitle={activeTags.length > 0 ? "No topics with these tags" : "No topics yet"}
      emptyHint={activeTags.length > 0 ? "Clear a tag filter to see more" : "Start a research agent or create a topic"}
    >
      {visibleTopics.map(renderTopicRow)}
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
      <ResearchAgentSessions selected={selected} onAgentChange={setAgentId} />

      <div className="shrink-0 px-2 py-1.5 border-b border-primary/50">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search dossiers and tags…" aria-label="Search research" />
      </div>
      {allTags.length > 0 && !trimmedQuery && (
        <div className="shrink-0 flex flex-wrap gap-1 px-2 py-1.5 border-b border-primary/50" role="group" aria-label="Filter by tag">
          {allTags.map(tag => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2 text-[11px] leading-5 cursor-pointer focus-ring ${active ? "border-accent bg-accent-muted text-accent" : "border-primary/60 text-muted hover:text-primary"}`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
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
      {tagEditTarget && (
        <CreateItemModal
          title={`Tags for ${tagEditTarget.name}`}
          placeholder="acme, due-diligence"
          pattern={/^[\s\S]*$/}
          validationError="Enter tags separated by commas."
          initialValue={tagEditTarget.tags.join(", ")}
          createLabel="Save tags"
          createIcon={Tag}
          onCreate={handleSaveTags}
          onClose={() => setTagEditTarget(null)}
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
