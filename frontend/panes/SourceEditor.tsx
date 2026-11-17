import { type Source, today } from "@tokenring-ai/research/sources";
import { useId, useState } from "react";
import { type SourceFormValues, toFormValues, validateSourceForm } from "../lib/sourceForm.ts";

const INPUT = "w-full px-2 py-1 bg-secondary border border-primary rounded-md text-xs text-primary focus-ring";

/** Compact add / edit form for one source. `others` are the item's other sources (for duplicate detection). */
export default function SourceEditor({
  initial,
  others,
  onSubmit,
  onCancel,
}: {
  initial: Source | null;
  others: readonly Source[];
  onSubmit: (source: Source) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState<SourceFormValues>(() => toFormValues(initial, today()));
  const [errors, setErrors] = useState<{ url?: string; accessed?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof SourceFormValues) => (event: { target: { value: string } }) => setValues(prev => ({ ...prev, [field]: event.target.value }));

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const result = validateSourceForm(values, others);
    if (!result.source) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.source);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : String(error) });
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-label={initial ? "Edit source" : "Add source"} className="mt-2 space-y-2 rounded-lg border border-primary p-2">
      <div>
        <label htmlFor={`${id}-url`} className="block text-xs text-muted mb-0.5">
          URL <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          value={values.url}
          onChange={set("url")}
          placeholder="https://"
          className={INPUT}
          aria-invalid={errors.url ? true : undefined}
          aria-describedby={errors.url ? `${id}-url-error` : undefined}
          autoFocus
        />
        {errors.url && (
          <p id={`${id}-url-error`} role="alert" className="mt-0.5 text-xs text-red-500">
            {errors.url}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label htmlFor={`${id}-title`} className="block text-xs text-muted mb-0.5">
            Title
          </label>
          <input id={`${id}-title`} value={values.title} onChange={set("title")} className={INPUT} />
        </div>
        <div>
          <label htmlFor={`${id}-publisher`} className="block text-xs text-muted mb-0.5">
            Publisher
          </label>
          <input id={`${id}-publisher`} value={values.publisher} onChange={set("publisher")} className={INPUT} />
        </div>
        <div>
          <label htmlFor={`${id}-accessed`} className="block text-xs text-muted mb-0.5">
            Accessed
          </label>
          <input
            id={`${id}-accessed`}
            type="date"
            value={values.accessed}
            onChange={set("accessed")}
            className={INPUT}
            aria-invalid={errors.accessed ? true : undefined}
            aria-describedby={errors.accessed ? `${id}-accessed-error` : undefined}
          />
          {errors.accessed && (
            <p id={`${id}-accessed-error`} role="alert" className="mt-0.5 text-xs text-red-500">
              {errors.accessed}
            </p>
          )}
        </div>
      </div>
      {errors.form && (
        <p role="alert" className="text-xs text-red-500">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-2.5 py-1 text-xs text-muted hover:text-primary rounded-md focus-ring cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-2.5 py-1 text-xs font-medium bg-accent text-white rounded-md focus-ring cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Saving…" : initial ? "Save source" : "Add source"}
        </button>
      </div>
    </form>
  );
}
