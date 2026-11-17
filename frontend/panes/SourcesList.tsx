import type { Source } from "@tokenring-ai/research/sources";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import SourceEditor from "./SourceEditor.tsx";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const ICON_BUTTON = "p-1 text-muted hover:text-primary rounded transition-colors focus-ring cursor-pointer";

function SourceRows({
  sources,
  editable,
  onEdit,
  onRemove,
}: {
  sources: readonly Source[];
  editable: boolean;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ol className="space-y-2 list-decimal pl-5 text-xs text-secondary">
      {sources.map((source, index) => (
        <li key={source.url}>
          <div className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline break-all"
                title={source.url}
              >
                {source.title ?? hostOf(source.url)}
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
              {(source.publisher || source.accessed) && (
                <span className="block text-muted">
                  {source.publisher}
                  {source.publisher && source.accessed ? " · " : ""}
                  {source.accessed ? `accessed ${source.accessed}` : ""}
                </span>
              )}
            </div>
            {editable && (
              <>
                <button type="button" className={ICON_BUTTON} onClick={() => onEdit(index)} aria-label={`Edit source ${index + 1}`} title="Edit source">
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className={`${ICON_BUTTON} hover:text-red-500`}
                  onClick={() => onRemove(index)}
                  aria-label={`Remove source ${index + 1}`}
                  title="Remove source"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** How long the "Undo" offer after a removal stays up. */
const UNDO_MS = 8000;

/**
 * An item's structured sources, kept visually apart from its Markdown.
 * `collapsible` folds the list into a disclosure so the editor keeps its room.
 * With `onSave` the list is editable: add, edit and remove write the complete new list through `onSave`
 * (which rejects to report a failure); removing offers an Undo that writes the previous list back.
 */
export default function SourcesList({
  sources,
  collapsible = false,
  onSave,
}: {
  sources: readonly Source[];
  collapsible?: boolean;
  onSave?: (next: Source[]) => Promise<void>;
}) {
  const editable = onSave !== undefined;
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [undo, setUndo] = useState<{ previous: Source[]; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const offerUndo = useCallback((previous: Source[], label: string) => {
    if (timer.current) clearTimeout(timer.current);
    setUndo({ previous, label });
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  const save = useCallback(
    async (next: Source[]) => {
      if (!onSave) return;
      await onSave(next);
    },
    [onSave],
  );

  const handleSubmit = async (source: Source) => {
    const next = editing === "new" || editing === null ? [...sources, source] : sources.map((existing, index) => (index === editing ? source : existing));
    await save(next);
    setEditing(null);
  };

  const handleRemove = async (index: number) => {
    const removed = sources[index];
    if (!removed) return;
    setError(null);
    try {
      await save(sources.filter((_, i) => i !== index));
      setEditing(null);
      offerUndo([...sources], removed.title ?? hostOf(removed.url));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUndo = async () => {
    if (!undo) return;
    setError(null);
    try {
      await save(undo.previous);
      if (timer.current) clearTimeout(timer.current);
      setUndo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (sources.length === 0 && !editable) return null;
  const heading = `Sources (${sources.length})`;

  const body = (
    <>
      {sources.length > 0 && (
        <SourceRows sources={sources} editable={editable} onEdit={index => setEditing(index)} onRemove={index => void handleRemove(index)} />
      )}
      {sources.length === 0 && <p className="text-xs text-muted">No sources yet.</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
      {undo && (
        <p role="status" className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="truncate">Removed {undo.label}.</span>
          <button type="button" onClick={() => void handleUndo()} className="text-accent hover:underline focus-ring cursor-pointer">
            Undo
          </button>
        </p>
      )}
      {editable && editing === null && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline focus-ring cursor-pointer"
        >
          <Plus className="w-3 h-3" aria-hidden="true" /> Add source
        </button>
      )}
      {editable && editing !== null && (
        <SourceEditor
          key={editing}
          initial={editing === "new" ? null : (sources[editing] ?? null)}
          others={editing === "new" ? sources : sources.filter((_, index) => index !== editing)}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );

  if (collapsible) {
    return (
      <details className="shrink-0 border-t border-primary px-4 py-2 max-h-72 overflow-y-auto" aria-label="Sources" open={editing !== null || undefined}>
        <summary className="cursor-pointer text-xs font-medium text-primary">{heading}</summary>
        <div className="mt-2">{body}</div>
      </details>
    );
  }

  return (
    <section className="mt-8 border-t border-primary pt-4" aria-label="Sources">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{heading}</h2>
      {body}
    </section>
  );
}
