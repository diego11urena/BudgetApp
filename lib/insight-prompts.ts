/**
 * The follow-up prompt an insight can carry. Tapping the insight goes to
 * its destination screen with the prompt encoded in the URL, and that
 * screen's InsightPromptHost opens the matching sheet once it appears.
 * Each kind is a small, serializable descriptor; the host loads (and
 * ownership-checks) whatever data the sheet needs. `key` is the insight's
 * own key, so an answer can be remembered against it.
 */
export type InsightPrompt =
  | { kind: "duplicate"; key: string; ids: [string, string] }
  | { kind: "uncategorized"; key: string }
  /** target = the recurring expense. */
  | { kind: "missed" | "price-change"; key: string; target: string }
  /** target = the transaction. */
  | { kind: "large" | "new-recurring"; key: string; target: string }
  /** target = the category. */
  | { kind: "category-up"; key: string; target: string }
  /** amount = what's left, e.g. "123.45"; cycle = a closed cycle the leftover belongs to (absent: the current one). */
  | { kind: "leftover"; key: string; amount: string; cycle?: string };

export type InsightPromptKind = InsightPrompt["kind"];

const TARGET_KINDS = ["missed", "price-change", "large", "new-recurring", "category-up"] as const;

/** A destination path plus the prompt, as the card's link. Extra query params (a filter) ride along. */
export function promptHref(path: string, prompt: InsightPrompt, query: Record<string, string> = {}): string {
  const params = new URLSearchParams(query);
  params.set("prompt", prompt.kind);
  params.set("insight", prompt.key);
  if (prompt.kind === "duplicate") params.set("ids", prompt.ids.join(","));
  if ("target" in prompt) params.set("target", prompt.target);
  if (prompt.kind === "leftover") {
    params.set("amount", prompt.amount);
    if (prompt.cycle) params.set("cycle", prompt.cycle);
  }
  return `${path}?${params.toString()}`;
}

const ID = /^[a-z0-9]{1,40}$/i;

/** Reads a prompt back from a destination page's search params; null for anything malformed. */
export function parsePrompt(searchParams: Record<string, string | string[] | undefined>): InsightPrompt | null {
  const get = (k: string) => (typeof searchParams[k] === "string" ? (searchParams[k] as string) : "");
  const key = get("insight");
  const kind = get("prompt");
  if (!key || key.length > 200) return null;

  if (kind === "duplicate") {
    const ids = get("ids").split(",");
    if (ids.length !== 2 || !ids.every((id) => ID.test(id))) return null;
    return { kind, key, ids: [ids[0], ids[1]] };
  }
  if (kind === "uncategorized") return { kind, key };
  if (kind === "leftover") {
    const amount = get("amount");
    const cycle = get("cycle");
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount) || (cycle && !ID.test(cycle))) return null;
    return cycle ? { kind, key, amount, cycle } : { kind, key, amount };
  }
  if ((TARGET_KINDS as readonly string[]).includes(kind)) {
    const target = get("target");
    if (!ID.test(target)) return null;
    return { kind: kind as (typeof TARGET_KINDS)[number], key, target } as InsightPrompt;
  }
  return null;
}
