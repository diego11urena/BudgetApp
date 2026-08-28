import { formatFriendlyDate } from "@/lib/format";
import { HeroCardActions } from "./HeroCardActions";

/**
 * Auto-detects a stale cycle by expected date (fix-list batch 11.5,
 * decision 2) -- getOrCreateDraftCycle keeps a cycle open indefinitely, so
 * without this, every number on Home quietly goes stale the moment the
 * quincena's calendar end passes and the user hasn't tapped "I just got
 * paid" yet (forgetting to is the app's single point of failure, per the
 * fix-list's own framing). Deliberately date-based, not Gmail-deposit-
 * based -- parsing bank-deposit emails to infer a real payday needs
 * fragile heuristics (recognizing the deposit as *the* paycheck, not just
 * any incoming transfer) that risk false positives; the calendar date is
 * already a reliable, zero-parsing signal computeQuincenaPace's own
 * "ended" phase already derives, just never surfaced this prominently
 * before (it used to be a single line of pace text below the hero number,
 * easy to miss, not a real notification).
 *
 * Always mounted by the caller regardless of isOverdue -- see
 * HeroCardActions' own showBanner doc comment for why gating this
 * component's mount on that condition (rather than just the trigger's
 * visibility) would wipe its in-flight confirm/closed-summary state the
 * instant justGotPaidAction succeeds.
 */
export function PaydayOverdueBanner({ cycleEndDate, isOverdue }: { cycleEndDate: Date; isOverdue: boolean }) {
  return (
    <HeroCardActions
      variant="banner"
      showBanner={isOverdue}
      bannerLabel={`Your quincena ended ${formatFriendlyDate(cycleEndDate)} — did you get paid?`}
    />
  );
}
