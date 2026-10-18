import { describe, expect, it } from "vitest";
import { parsePrompt, promptHref } from "./insight-prompts";

describe("insight prompt URLs", () => {
  it("round-trips a duplicate prompt", () => {
    const href = promptHref("/transactions", { kind: "duplicate", key: "duplicate:a:b", ids: ["a", "b"] });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parsePrompt(params)).toEqual({ kind: "duplicate", key: "duplicate:a:b", ids: ["a", "b"] });
  });

  it("rejects malformed input", () => {
    expect(parsePrompt({ prompt: "duplicate", insight: "k", ids: "a" })).toBeNull();
    expect(parsePrompt({ prompt: "duplicate", insight: "k", ids: "a,b;drop" })).toBeNull();
    expect(parsePrompt({ prompt: "nope", insight: "k" })).toBeNull();
    expect(parsePrompt({ prompt: "duplicate", ids: "a,b" })).toBeNull();
  });
});
