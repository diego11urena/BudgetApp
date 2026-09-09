"use client";

import SmallMultiples from "@/app/(app)/_components/charts/SmallMultiples";
import { useT, useVocab } from "@/app/_components/LocaleProvider";
import type { FixedShareTrend } from "@/lib/breakdown-v2";

/**
 * Chapter 03 — is the fixed share of spending creeping up? Below two
 * periods there's no direction to state, so it says so rather than
 * classifying a single data point as "holding steady".
 */
export default function FixedFlexChapter({ fixedShare }: { fixedShare: FixedShareTrend }) {
  const t = useT();
  const vocab = useVocab();

  if (fixedShare.periods.length < 2) {
    return <p className="breakdown-chapter-empty">{t.breakdown.notEnoughHistory(vocab)}</p>;
  }

  const headline =
    fixedShare.direction === "rising"
      ? t.breakdown.fixedShareRising(vocab)
      : fixedShare.direction === "falling"
        ? t.breakdown.fixedShareFalling(vocab)
        : t.breakdown.fixedShareSteady(vocab);

  return (
    <>
      <p className="breakdown-chapter-headline">{headline}</p>
      <p className="breakdown-chapter-subcopy">
        {t.breakdown.fixedShareSubcopy(fixedShare.oldPct, fixedShare.newPct)}
      </p>
      <SmallMultiples periods={fixedShare.periods.map((p) => ({ ...p, label: "" }))} />
      <div className="breakdown-small-multiples-captions">
        <span>{t.breakdown.smallMultiplesCaptionOldest(vocab, fixedShare.periods.length - 1)}</span>
        <span>{t.breakdown.smallMultiplesCaptionNow}</span>
      </div>
    </>
  );
}
