/** The Summary's one big line -- fully composed by the caller from t.summary.headline. */
export default function SummaryHeadline({ headline }: { headline: string }) {
  return (
    <div className="summary-headline">
      <h1>{headline}</h1>
    </div>
  );
}
