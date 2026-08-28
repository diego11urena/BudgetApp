import { redirect } from "next/navigation";

/** Moved to /transactions/breakdown -- it's a view of Activity (a pie chart instead of a list), not a Home concept. See the Balboa fix list's batch 11.3. Kept as a redirect, not a 404, for any old bookmark/link. */
export default function BreakdownPageRedirect() {
  redirect("/transactions/breakdown");
}
