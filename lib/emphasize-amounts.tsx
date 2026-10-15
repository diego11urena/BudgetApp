import { Fragment, type ReactNode } from "react";

/**
 * Wraps every currency figure in a sentence ("$1,234.56", "-$20") in
 * <strong>, so a line of copy can carry its key value in bold -- the
 * design system's Insights rows and the hero's pace line both do. Purely
 * presentational: the sentence itself still comes from the dictionary as
 * one translated string, nothing is hardcoded here.
 */
export function emphasizeAmounts(text: string): ReactNode {
  const parts = text.split(/([-−]?\$[\d,]+(?:\.\d+)?)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}

/** Bolds each of the given phrases wherever it appears in the sentence. */
export function emphasize(text: string, phrases: string[]): ReactNode {
  const wanted = phrases.filter(Boolean);
  if (wanted.length === 0) return text;
  const escaped = wanted.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}
