import { type Source, urlKey } from "@tokenring-ai/research/sources";

export interface SourceFormValues {
  url: string;
  title: string;
  publisher: string;
  accessed: string;
}

export interface SourceFormErrors {
  url?: string;
  accessed?: string;
}

export function toFormValues(source: Source | null, today: string): SourceFormValues {
  return { url: source?.url ?? "", title: source?.title ?? "", publisher: source?.publisher ?? "", accessed: source?.accessed ?? today };
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Checks one source the way the server will: an absolute http(s) URL, a real YYYY-MM-DD date, and a URL not
 * already listed on the item (`others` is the list without the source being edited).
 */
export function validateSourceForm(values: SourceFormValues, others: readonly Source[]): { errors: SourceFormErrors; source?: Source } {
  const errors: SourceFormErrors = {};
  const url = values.url.trim();
  if (!url) errors.url = "Enter the URL of the source.";
  else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {}
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) errors.url = "Use a full http:// or https:// URL.";
    else if (others.some(other => urlKey(other.url) === urlKey(url))) errors.url = "This URL is already listed.";
  }
  const accessed = values.accessed.trim();
  if (accessed && !isRealDate(accessed)) errors.accessed = "Use a valid date (YYYY-MM-DD).";
  if (errors.url || errors.accessed) return { errors };

  const title = values.title.trim();
  const publisher = values.publisher.trim();
  return {
    errors,
    source: { url, ...(title ? { title } : {}), ...(publisher ? { publisher } : {}), ...(accessed ? { accessed } : {}) },
  };
}
