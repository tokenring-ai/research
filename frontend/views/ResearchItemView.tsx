import Editor from "@monaco-editor/react";
import AgentTodoList from "@tokenring-ai/one-frontend/components/AgentTodoList.tsx";
import { markdownLinkComponents } from "@tokenring-ai/one-frontend/components/chat/MarkdownLink.tsx";
import ConfirmModal from "@tokenring-ai/one-frontend/components/ui/ConfirmModal.tsx";
import EditorSaveBar from "@tokenring-ai/one-frontend/components/ui/EditorSaveBar.tsx";
import EmptyState from "@tokenring-ai/one-frontend/components/ui/EmptyState.tsx";
import EmptyStateWithPrompt from "@tokenring-ai/one-frontend/components/ui/EmptyStateWithPrompt.tsx";
import LoadingState from "@tokenring-ai/one-frontend/components/ui/LoadingState.tsx";
import SaveAsModal from "@tokenring-ai/one-frontend/components/ui/SaveAsModal.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import ViewHeader from "@tokenring-ai/one-frontend/components/ui/ViewHeader.tsx";
import ViewModeToggle from "@tokenring-ai/one-frontend/components/ui/ViewModeToggle.tsx";
import ViewShell from "@tokenring-ai/one-frontend/components/ui/ViewShell.tsx";
import { useDashboardApi } from "@tokenring-ai/one-frontend/dock/DashboardApiContext.tsx";
import { setPanelBadge } from "@tokenring-ai/one-frontend/dock/panelBadges.ts";
import type { ViewPanelHandle, ViewProps } from "@tokenring-ai/one-frontend/dock/types.ts";
import { useKeyboardShortcuts } from "@tokenring-ai/one-frontend/hooks/useKeyboardShortcuts.ts";
import { useRemoteChangeDetection } from "@tokenring-ai/one-frontend/hooks/useRemoteChangeDetection.ts";
import { downloadTextFile } from "@tokenring-ai/one-frontend/lib/transcriptExport.ts";
import { runOrConfirm } from "@tokenring-ai/one-frontend/lib/uiPreferences.ts";
import { researchRPCClient, useItems, useTopics } from "@tokenring-ai/one-frontend/rpc.ts";
import { useMonacoTheme } from "@tokenring-ai/one-frontend/theme/bridges/useMonacoTheme.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Download, Eye, FileText, FolderInput, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ResearchItemParams } from "../app.tsx";
import { NAME_PATTERN, researchItemKey } from "../lib/paths.ts";
import { useResearchNavigation } from "../lib/researchShared.tsx";
import { getItemDraft, setItemDraft, useItemDraft, useResearchAgentSession } from "../lib/researchStore.ts";

function DossierPreview({ content }: { content: string }) {
  return (
    <ViewShell>
      <div className="p-5 sm:p-6 max-w-3xl mx-auto">
        <article
          className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:text-primary prose-p:text-secondary prose-code:text-primary
          prose-a:text-accent prose-strong:text-primary prose-blockquote:text-muted
          prose-li:text-secondary prose-th:text-primary prose-td:text-secondary
          prose-code:bg-tertiary prose-code:rounded prose-code:px-1 prose-code:py-0.5
          prose-pre:bg-tertiary prose-pre:border prose-pre:border-primary"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </ViewShell>
  );
}

/**
 * The panel before a dossier is opened: browse existing research or describe a
 * new topic to start a research agent. The agent itself belongs to the topics
 * navigator, which publishes the `start` hook this prompt calls.
 */
function ResearchLanding({ panel }: { panel: ViewPanelHandle<ResearchItemParams> }) {
  const { data } = useTopics();
  const session = useResearchAgentSession();
  const topicCount = data?.topics.length ?? 0;

  useEffect(() => {
    panel.setTitle("Research");
  }, [panel]);

  const handleStartResearch = useCallback(
    async (query: string): Promise<boolean> => {
      if (!session) {
        toastManager.error("Open the Research topics panel to start a research agent", { duration: 5000 });
        return false;
      }
      return session.start(query);
    },
    [session],
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      <EmptyStateWithPrompt
        icon={Search}
        iconGradient="from-indigo-500 to-violet-600"
        title="Start researching"
        descriptionWithContent={
          <>
            Select existing research from the <span className="font-medium text-secondary">Topics</span> panel to view it, or describe a new topic below to
            start a research agent.
          </>
        }
        descriptionEmpty={
          <>Describe what you want to research below. A research agent will search the web and write markdown findings into topics in the Topics panel.</>
        }
        hasContent={topicCount > 0}
        agentRunningMessage="A research agent is running in the chat panel. Select an item from the Topics panel to open it, or continue the conversation with the agent."
        hasAgent={!!session?.agentId}
        promptLabel="Research prompt"
        promptPlaceholder="e.g. Solid-state battery commercialization timeline 2024–2026"
        promptAriaLabel="Research query"
        submitLabel="Start research"
        submitAriaLabel="Start research agent"
        buttonVariant="indigo"
        onSubmit={handleStartResearch}
      />
      {session?.agentId && (
        <section aria-label="Research agent progress" className="shrink-0 mx-auto w-full max-w-xl px-4 pb-4">
          <AgentTodoList agentId={session.agentId} agentName="research agent" className="pl-5 border-t border-primary/40 pt-2" />
        </section>
      )}
    </div>
  );
}

/** One markdown dossier: preview, editor, save / save-as / delete. */
function ResearchItem({ topicName, itemName, panel }: { topicName: string; itemName: string; panel: ViewPanelHandle<ResearchItemParams> }) {
  const dashboard = useDashboardApi();
  const { openItem, closeItem, moveItem } = useResearchNavigation();
  const monacoTheme = useMonacoTheme();
  const topics = useTopics();
  const items = useItems(topicName);

  const key = researchItemKey(topicName, itemName);
  const draft = useItemDraft(key);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Reopening a panel that still holds unsaved edits lands back in the editor.
  const [viewMode, setViewMode] = useState<"preview" | "edit">(() => (getItemDraft(researchItemKey(topicName, itemName)) === null ? "preview" : "edit"));
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const content = draft ?? savedContent ?? "";
  const isReady = savedContent !== null;
  const isDirty = isReady && draft !== null && draft !== savedContent;

  // Bridge so load/save (defined before the hook) can move the remote-change baseline.
  const markLoadedRef = useRef<(updatedAt: string | null) => void>(() => {});

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoadError(null);
      try {
        const { item } = await researchRPCClient.getItem({ topicName, name: itemName });
        if (!item) {
          const message = `Item "${itemName}" not found in topic "${topicName}"`;
          if (!options?.silent) {
            toastManager.error(message, { duration: 4000 });
            setLoadError(message);
          }
          return;
        }
        setSavedContent(item.content);
        setLoadError(null);
        markLoadedRef.current(item.updatedAt);
      } catch (e: unknown) {
        if (!options?.silent) {
          toastManager.error(formatError(e), { duration: 4000 });
          setLoadError(formatError(e));
        }
      }
    },
    [itemName, topicName],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    panel.setTitle(itemName);
  }, [itemName, panel]);

  // Unsaved edits show as a dot on the tab; the draft itself survives closing the panel.
  useEffect(() => {
    setPanelBadge(panel.panelId, isDirty ? { tone: "warning", title: "Unsaved changes" } : null);
  }, [isDirty, panel.panelId]);
  useEffect(() => () => setPanelBadge(panel.panelId, null), [panel.panelId]);

  // The agent rewrites dossiers while it researches; reload silently unless the user has edits.
  const summary = items.data?.items.find(entry => entry.name === itemName) ?? null;
  const { markLoaded } = useRemoteChangeDetection({
    documentKey: key,
    isDocumentReady: isReady,
    isDirty,
    strategy: { type: "streaming", remoteMeta: summary?.updatedAt ?? null, getUpdatedAt: (meta: string) => meta },
    onRemoteChange: () => load({ silent: true }),
  });
  markLoadedRef.current = markLoaded;

  const handleSave = useCallback(async () => {
    if (!isReady || draft === null) return;
    setIsSaving(true);
    try {
      const { item } = await researchRPCClient.updateItem({ topicName, name: itemName, content: draft });
      setSavedContent(item.content);
      setItemDraft(researchItemKey(topicName, itemName), null);
      markLoadedRef.current(item.updatedAt);
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [draft, isReady, itemName, topicName]);

  // Ctrl/⌘+S saves the dossier on screen.
  useKeyboardShortcuts([{ key: "s", allowInEditable: true, enabled: panel.isActive && isDirty, handler: () => void handleSave() }]);

  /** Save As writes a copy and this panel follows it, so the tab never points at stale params. */
  const handleSaveAs = useCallback(
    async (nextTopic: string, nextName: string) => {
      try {
        const { item } = await researchRPCClient.createItem({ topicName: nextTopic, name: nextName, content });
        setItemDraft(researchItemKey(topicName, itemName), null);
        setSaveAsOpen(false);
        dashboard.updateViewParams(panel.panelId, { topicName: item.topicName, itemName: item.name });
        openItem(item.topicName, item.name);
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [content, dashboard, itemName, openItem, panel.panelId, topicName],
  );

  /** Renames / moves the file; open panels, the draft and the URL follow it. */
  const handleMove = useCallback(
    async (nextTopic: string, nextName: string) => {
      if (nextTopic === topicName && nextName === itemName) {
        setMoveOpen(false);
        return;
      }
      try {
        const { item } = await researchRPCClient.renameItem({ topicName, name: itemName, newTopicName: nextTopic, newName: nextName });
        setMoveOpen(false);
        moveItem({ topicName, itemName }, { topicName: item.topicName, itemName: item.name });
        toastManager.success("Moved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [itemName, moveItem, topicName],
  );

  /** Downloads what is on screen, unsaved edits included. */
  const handleExport = useCallback(() => {
    downloadTextFile(`${itemName}.md`, content, "text/markdown");
  }, [content, itemName]);

  const handleDelete = useCallback(async () => {
    try {
      const { success } = await researchRPCClient.deleteItem({ topicName, name: itemName });
      // A failed delete keeps the panel, its draft and the dialog open.
      if (!success) throw new Error(`Could not delete "${itemName}"`);
      setItemDraft(researchItemKey(topicName, itemName), null);
      setDeleteOpen(false);
      closeItem(topicName, itemName);
      panel.close();
      toastManager.success("Deleted", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    }
  }, [closeItem, itemName, panel, topicName]);

  let body: React.ReactNode;
  if (isReady) {
    body =
      viewMode === "preview" ? (
        <DossierPreview content={content} />
      ) : (
        <ViewShell scroll={false}>
          <Editor
            height="100%"
            language="markdown"
            beforeMount={monacoTheme.beforeMount}
            theme={monacoTheme.theme}
            value={content}
            onChange={value => setItemDraft(key, value ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              padding: { top: 12 },
            }}
          />
        </ViewShell>
      );
  } else if (loadError) {
    body = (
      <EmptyState
        variant="page"
        className="h-full"
        icon={FileText}
        title="Research item not found"
        hint={loadError}
        ctaLabel="Retry"
        ctaIcon={RotateCcw}
        onCta={() => void load()}
        action={
          <button
            type="button"
            onClick={() => panel.close()}
            className="px-3 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            Close panel
          </button>
        }
      />
    );
  } else {
    body = <LoadingState message={`Loading ${topicName} / ${itemName}…`} className="h-full" />;
  }

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          variant="navigator"
          title={
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="flex-1 min-w-0 truncate text-xs text-muted font-mono" title={`${topicName} / ${itemName}`}>
                {topicName} / {itemName}
              </span>
              {isReady && (
                <>
                  <ViewModeToggle
                    aria-label="View mode"
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      { value: "preview", label: "Preview", title: "Preview markdown", icon: Eye },
                      { value: "edit", label: "Edit", title: "Edit markdown source", icon: Pencil },
                    ]}
                  />
                  <EditorSaveBar
                    isDirty={isDirty}
                    isSaving={isSaving}
                    hasItem
                    onSave={handleSave}
                    onSaveAs={() => setSaveAsOpen(true)}
                    variant="accent"
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => setMoveOpen(true)}
                          className="p-1.5 text-muted hover:text-primary rounded-lg transition-colors focus-ring cursor-pointer"
                          title="Rename or move to another topic"
                          aria-label="Rename or move item"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleExport}
                          className="p-1.5 text-muted hover:text-primary rounded-lg transition-colors focus-ring cursor-pointer"
                          title="Download as Markdown"
                          aria-label="Export item as Markdown"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runOrConfirm(
                              "Delete item?",
                              () => setDeleteOpen(true),
                              () => void handleDelete(),
                            )
                          }
                          className="p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors focus-ring cursor-pointer"
                          title="Delete item"
                          aria-label="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    }
                  />
                </>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex-1 min-h-0">{body}</div>

      {saveAsOpen && (
        <SaveAsModal
          title="Save As"
          containerField={{
            label: "Topic",
            placeholder: "solid-state-batteries",
            initialValue: topicName,
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: (topics.data?.topics ?? []).map(topic => ({ value: topic.name })),
          }}
          itemField={{
            label: "Item name",
            placeholder: "summary",
            initialValue: `${itemName}-copy`,
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: [],
            autoFocus: true,
            selectOnFocus: true,
          }}
          onSave={handleSaveAs}
          onClose={() => setSaveAsOpen(false)}
        />
      )}
      {moveOpen && (
        <SaveAsModal
          title="Rename or move"
          saveLabel="Move"
          saveIcon={FolderInput}
          containerField={{
            label: "Topic",
            placeholder: "solid-state-batteries",
            initialValue: topicName,
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: (topics.data?.topics ?? []).map(topic => ({ value: topic.name })),
          }}
          itemField={{
            label: "Item name",
            placeholder: "summary",
            initialValue: itemName,
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: [],
            autoFocus: true,
            selectOnFocus: true,
          }}
          onSave={handleMove}
          onClose={() => setMoveOpen(false)}
        />
      )}
      {deleteOpen && (
        <ConfirmModal
          title="Delete item?"
          message={`This will permanently delete "${itemName}" from topic "${topicName}".`}
          onConfirm={() => handleDelete()}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </ViewShell>
  );
}

/**
 * One research dossier per panel. Without params the panel is the landing
 * prompt, which the next dossier opened from the navigator fills in place.
 */
export default function ResearchItemView({ params, panel }: ViewProps<ResearchItemParams>) {
  const { topicName, itemName } = params;
  if (!topicName || !itemName) return <ResearchLanding panel={panel} />;
  // Keyed so a panel that follows a rename (or Save As) reloads from scratch.
  return <ResearchItem key={researchItemKey(topicName, itemName)} topicName={topicName} itemName={itemName} panel={panel} />;
}
