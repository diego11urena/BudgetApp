import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { useLocale } from "@/app/_components/LocaleProvider";
import type { SpendComparison } from "@/lib/summary";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";

/**
 * "$47 less than your last three quincenas — your lightest since May."
 * Wires up lib/summary.ts's computeSpendComparison (previously computed
 * but never actually shown anywhere -- see git history). Renders nothing
 * when there isn't enough history yet (comparison is null/incomplete) --
 * matching computeSpendComparison's own "degrade to nulls" contract.
 */
export default function SummaryContextLine({
  comparison,
  t,
  vocab,
}: {
  comparison: Partial<SpendComparison> | null;
  t: Dictionary;
  vocab: PeriodVocab;
}) {
  const locale = useLocale();

  if (!comparison || comparison.deltaAmount === undefined || comparison.isLighter === undefined) {
    return null;
  }

  return (
    <p className="summary-context-line">
      {t.summary.subcopyDelta(vocab, formatCurrency(Math.abs(comparison.deltaAmount)), comparison.isLighter)}
      {comparison.label && comparison.sincePeriodStart && (
        <> — {t.summary.subcopyLightestSince(vocab, comparison.label, formatMonthLabel(comparison.sincePeriodStart, locale))}</>
      )}
    </p>
  );
}
