import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompletedAt: true },
    });
    redirect(user?.onboardingCompletedAt ? "/dashboard" : "/onboarding");
  }

  const dictionary = getDictionary(await getRequestLocale());
  const t = dictionary.landing;
  // Landing is always pre-auth -- no real budgetFrequency to reflect yet, so
  // this defaults to quincenal, matching the app's own branding (see
  // app/layout.tsx's resolveBudgetFrequency, which defaults the same way).
  const vocab = dictionary.periodVocab.quincenal;

  const HOW_IT_WORKS = [
    { title: t.feature1Title, body: t.feature1Body },
    { title: t.feature2Title, body: t.feature2Body },
    { title: t.feature3Title, body: t.feature3Body },
  ];

  // Mobile's own compact stand-in for the three how-it-works cards -- "too
  // heavy for a phone screen" per the design handoff's own mobile spec.
  const MOBILE_CHECKLIST = [t.checklistSetup, t.checklistBills, t.checklistGmail];

  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <Image src="/balboa-logo.png" alt="" width={40} height={40} className="landing-brand-logo" />
          <span className="landing-brand-word">Balboa</span>
        </Link>
        <nav className="landing-nav" aria-label={t.navPrimary}>
          <a href="#how-it-works">{t.navHowItWorks}</a>
          <a href="#how-it-works">{t.navFeatures}</a>
          <a href="#pricing">{t.navPricing}</a>
        </nav>
        <div className="landing-header-actions">
          <Link href="/login" className="button button--chip landing-header-login">
            {t.logIn}
          </Link>
          <Link href="/signup" className="button landing-header-cta">
            {t.getStarted}
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          {/* Desktop only -- mobile drops the eyebrow pill entirely (see
              the handoff's own mobile spec). */}
          <span className="landing-eyebrow">{t.eyebrow(vocab)}</span>
          <h1>{t.h1}</h1>
          {/* Two sub-copy variants, toggled by breakpoint (not just resized)
              -- mobile's is shorter/more casual per the handoff's own
              literal copy, not a paraphrase. */}
          <p className="landing-hero-sub landing-hero-sub--desktop">{t.subDesktop}</p>
          <p className="landing-hero-sub landing-hero-sub--mobile">{t.subMobile(vocab)}</p>

          {/* Desktop: two buttons side by side. */}
          <div className="landing-hero-buttons">
            <Link href="/signup" className="button landing-cta-primary">
              {t.getStarted}
            </Link>
            <Link href="/login" className="button button--chip landing-cta-secondary">
              {t.logIn}
            </Link>
          </div>
          <p className="landing-trust-line landing-trust-line--desktop">
            <span className="landing-trust-dot" aria-hidden="true" />
            {t.trustLineDesktop}
          </p>

          {/* Mobile: one full-width button + a plain text link -- "the link
              is the only other auth entry; do not add a second Log in
              button" per the handoff. */}
          <div className="landing-hero-mobile-cta">
            <Link href="/signup" className="button landing-cta-primary">
              {t.getStarted}
            </Link>
            <p className="landing-mobile-login-link">
              {t.alreadyHaveAccount}
              <Link href="/login">{t.logIn}</Link>
            </p>
          </div>

          {/* Mobile-only checklist, replacing the numbered how-it-works
              cards -- "too heavy for a phone screen." */}
          <ul className="landing-checklist">
            {MOBILE_CHECKLIST.map((label) => (
              <li key={label}>
                <Check size={18} strokeWidth={2.4} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <p className="landing-trust-line landing-trust-line--mobile">{t.trustLineMobile}</p>
        </div>

        {/* Desktop only -- mobile drops the whole preview visual (no
            "Safe to spend" card, no device mock; see the handoff's own
            "removed on purpose" note). */}
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-device-mock">
            <div className="landing-device-screen">
              <p className="landing-device-label">{t.deviceLeftThisQuincena(vocab)}</p>
              <p className="landing-device-figure">$412.60</p>
              <div className="landing-device-rows">
                <div className="landing-device-row">
                  <span>{t.deviceGroceries}</span>
                  <div className="landing-device-track">
                    <div className="landing-device-fill landing-device-fill--navy" style={{ width: "62%" }} />
                  </div>
                </div>
                <div className="landing-device-row">
                  <span>{t.deviceTransport}</span>
                  <div className="landing-device-track">
                    <div className="landing-device-fill landing-device-fill--silver" style={{ width: "38%" }} />
                  </div>
                </div>
                <div className="landing-device-row">
                  <span>{t.deviceSavingsGoal}</span>
                  <div className="landing-device-track">
                    <div className="landing-device-fill landing-device-fill--savings" style={{ width: "74%" }} />
                  </div>
                </div>
              </div>
              <div className="landing-device-strip">{t.deviceNextQuincena(vocab)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop only -- mobile's stand-in is the checklist above. */}
      <section id="how-it-works" className="landing-how">
        {HOW_IT_WORKS.map((item, index) => (
          <div key={item.title} className="landing-how-card">
            <span className="landing-how-number">{index + 1}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="landing-cta-band" aria-label={t.getStarted}>
        <div>
          <h2>{t.ctaTitle(vocab)}</h2>
          <p>{t.ctaBody}</p>
        </div>
        <div className="landing-cta-band-buttons">
          <Link href="/signup" className="button landing-cta-band-primary">
            {t.getStarted}
          </Link>
          <Link href="/login" className="button landing-cta-band-secondary">
            {t.logIn}
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand landing-footer-brand">
          <Image src="/balboa-logo.png" alt="" width={26} height={26} className="landing-brand-logo" />
          <span>{t.footerCopyright}</span>
        </div>
        <div className="landing-footer-links">
          <a href="#privacy">{t.footerPrivacy}</a>
          <a href="#terms">{t.footerTerms}</a>
          <a href="#support">{t.footerSupport}</a>
        </div>
      </footer>
    </div>
  );
}
