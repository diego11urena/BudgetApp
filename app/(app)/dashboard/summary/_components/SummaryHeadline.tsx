import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummaryHeadlineProps {
  spent: string;
  leftOver: string;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummaryHeadline({
  spent,
  leftOver,
  vocab,
  t,
}: SummaryHeadlineProps) {
  return (
    <div className="summary-headline">
      <h1>
        You spent <span className="summary-headline-spent">{spent}</span>,
        <span className="summary-headline-left-over">{leftOver}</span> left over.
      </h1>
    </div>
  );
}
