/**
 * The follow-up prompt an insight can carry. Tapping the insight goes to
 * its destination screen with the prompt encoded in the URL, and that
 * screen's InsightPromptHost opens the matching sheet once it appears.
 * Each kind is a small, serializable descriptor; the host loads (and
 * ownership-checks) whatever data the sheet needs.
 */
export type InsightPrompt = { kind: "duplicate"; key: string; ids: [string, string] };

export type InsightPromptKind = InsightPrompt["kind"];

/** A destination path plus the prompt, as the card's link. Extra query params (a filter) can ride along. */
export function promptHref(path: string, prompt: InsightPrompt, query: Record<string, string> = {}): string {
  const params = new URLSearchParams(query);
  params.set("prompt", prompt.kind);
  params.set("insight", prompt.key);
  if (prompt.kind === "duplicate") params.set("ids", prompt.ids.join(","));
  return `${path}?${params.toString()}`;
}

const ID = /^[a-z0-9]{1,40}$/i;

/** Reads a prompt back from a destination page's search params; null for anything malformed. */
export function parsePrompt(searchParams: Record<string, string | string[] | undefined>): InsightPrompt | null {
  const get = (k: string) => (typeof searchParams[k] === "string" ? (searchParams[k] as string) : "");
  const key = get("insight");
  if (!key || key.length > 200) return null;
  if (get("prompt") === "duplicate") {
    const ids = get("ids").split(",");
    if (ids.length !== 2 || !ids.every((id) => ID.test(id))) return null;
    return { kind: "duplicate", key, ids: [ids[0], ids[1]] };
  }
  return null;
}
