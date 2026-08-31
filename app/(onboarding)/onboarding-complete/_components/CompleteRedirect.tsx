"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirects to /dashboard after a beat -- just long enough to read "You're set." */
export function CompleteRedirect() {
  const router = useRouter();

  useEffect(() => {
    const id = setTimeout(() => router.push("/dashboard"), 1500);
    return () => clearTimeout(id);
  }, [router]);

  return null;
}
