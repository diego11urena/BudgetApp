import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withActionErrorHandling } from "./action-error";

describe("withActionErrorHandling", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns the action's own result when it succeeds", async () => {
    const action = withActionErrorHandling(async (x: number) => ({ transactionId: String(x) }));
    await expect(action(1)).resolves.toEqual({ transactionId: "1" });
  });

  it("passes through the action's own validation-error return untouched", async () => {
    const action = withActionErrorHandling(async () => ({ error: "Invalid input" }));
    await expect(action()).resolves.toEqual({ error: "Invalid input" });
  });

  it("catches an unexpected throw and returns a generic error instead of letting it propagate", async () => {
    const action = withActionErrorHandling(async () => {
      throw new Error("connection terminated unexpectedly");
    });
    await expect(action()).resolves.toEqual({
      error: "Something went wrong. Your changes weren't saved — please try again.",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith("[action-error]", expect.any(Error));
  });

  it("lets a redirect() control-flow throw propagate unchanged, not swallowed into a generic error", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    const action = withActionErrorHandling(async () => {
      throw redirectError;
    });
    await expect(action()).rejects.toBe(redirectError);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("lets a notFound() control-flow throw propagate unchanged", async () => {
    const notFoundError = Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
    const action = withActionErrorHandling(async () => {
      throw notFoundError;
    });
    await expect(action()).rejects.toBe(notFoundError);
  });

  it("forwards every argument through to the wrapped action", async () => {
    const action = withActionErrorHandling(async (a: string, b: number) => ({ a, b }));
    await expect(action("x", 2)).resolves.toEqual({ a: "x", b: 2 });
  });
});
