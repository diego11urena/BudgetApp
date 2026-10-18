"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Closes an insight prompt: drops its params from the URL (so a refresh doesn't reopen it) and refetches. */
export function useFinishPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ["prompt", "insight", "ids", "target", "amount", "cycle"]) params.delete(k);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    router.refresh();
  };
}
