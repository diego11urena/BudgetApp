import Link from "next/link";
import type { LocaleValue } from "@/lib/i18n/locale";

export const CONTACT_EMAIL = "diego11urena@gmail.com";

export type LegalContent = { title: string; sections: { h: string; p: string[] }[] };

const LABELS: Record<LocaleValue, { back: string; updated: string }> = {
  en: { back: "Back to Balboa", updated: "Last updated" },
  es: { back: "Volver a Balboa", updated: "Última actualización" },
};

/** Shared layout for /privacy and /terms. Legal text lives in each page, not the i18n dictionaries: it's read as a whole, never reused piecemeal. */
export function LegalPage({ title, sections, updated, locale }: LegalContent & { updated: string; locale: LocaleValue }) {
  return (
    <main className="legal-page">
      <Link href="/">{LABELS[locale].back}</Link>
      <h1>{title}</h1>
      <p className="field-hint">
        {LABELS[locale].updated}: {updated}
      </p>
      {sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
