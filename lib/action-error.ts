const GENERIC_ERROR_MESSAGE = "Something went wrong. Your changes weren't saved — please try again.";

/**
 * The one shared shape every server action's return type is built from —
 * previously five different ad hoc contracts across the app
 * ({error}|{transactionId}|undefined, {error}|{deleted}|undefined,
 * {error?,field?}, {error?,success?}, Promise<void>), each a plausible
 * shape on its own but forcing every new action (and every component
 * calling one) to re-decide which pattern to follow. `T` is whatever a
 * successful call actually hands back -- `void` (the default) for an
 * action whose only signal is "didn't throw" (a redirect on success, or
 * genuinely nothing to report), a real payload type for one that does
 * (`{ transactionId: string }`, `{ deleted: Snapshot }`, `{ success: true }`
 * for a settings form that wants to show "Saved!"). The error branch is
 * always `{ error: string; field?: string }` -- field is optional and only
 * meaningful for a form that blames one specific input.
 */
export type ActionResult<T = void> = { error: string; field?: string } | T;

/**
 * redirect()/notFound() work by throwing a special error tagged with a
 * `digest` starting with "NEXT_REDIRECT"/"NEXT_NOT_FOUND" -- Next.js's own
 * mechanism for unwinding to the framework, not a real failure. A wrapper
 * that catches "whatever an action throws" must let these through
 * unchanged, or every redirect (e.g. the auth guard at the top of nearly
 * every action here) would get swallowed into a generic error instead of
 * actually navigating.
 */
function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

/**
 * Wraps a server action so an unexpected throw (a dropped Prisma
 * connection, a constraint violation, anything not already modeled as a
 * validation `{ error }` return) never reaches app/(app)/error.tsx and
 * wipes whatever the user had just typed. Logs the real error server-side
 * (so it's still diagnosable) and hands the client the same generic
 * `{ error }` shape every action's validation path already returns, which
 * every existing error-rendering callsite (aria-invalid, role="alert")
 * already knows how to show inline.
 */
export function withActionErrorHandling<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await action(...args);
    } catch (error) {
      if (isNextControlFlowError(error)) throw error;
      console.error("[action-error]", error);
      return { error: GENERIC_ERROR_MESSAGE } as Result;
    }
  };
}
