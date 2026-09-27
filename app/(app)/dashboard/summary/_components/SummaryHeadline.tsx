import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";

/**
 * The Summary's one big line -- "You spent $594 and saved $297." with the
 * saved amount in gold. Composed here (not by the caller as one opaque
 * string, unlike the old version) so the gold span can wrap just the
 * saved fragment without fighting EN/ES word order -- t.summary.headlinePrefix
 * and headlineSavedFragment are two separate templates for exactly that
 * reason (see their own doc comments in dictionary.ts).
 */
export default function SummaryHeadline({
  spent,
  saved,
  t,
  vocab,
}: {
  spent: string;
  saved: string;
  t: Dictionary;
  vocab: PeriodVocab;
}) {
  return (
    <div className="summary-headline">
      <h1>
        {t.summary.headlinePrefix(vocab, spent)}
        <span className="summary-headline-saved">{t.summary.headlineSavedFragment(saved)}</span>
      </h1>
    </div>
  );
}
