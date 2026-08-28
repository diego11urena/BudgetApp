import { redirect } from "next/navigation";

/** /goals merged into /plan (Bills + Goals, one screen) -- see the Balboa fix list's batch 11. Kept as a redirect, not a 404, for any old bookmark/link. */
export default function GoalsPageRedirect() {
  redirect("/plan");
}
