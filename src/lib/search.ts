/**
 * Shared case-insensitive, accent-insensitive, multi-token search matcher
 * used across general global search and every form-level filter.
 */

export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_./\\@#:+,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function combineSearchQueries(...queries: Array<string | undefined | null>): string {
  return queries
    .map((q) => (q ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function matchesSearch(
  query: string | undefined | null,
  ...fields: Array<unknown>
): boolean {
  const normQ = normalizeSearchText(query);
  if (!normQ) return true;
  const tokens = normQ.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = fields.map(normalizeSearchText).filter(Boolean).join(" ");
  if (!haystack) return false;
  return tokens.every((tok) => haystack.includes(tok));
}
