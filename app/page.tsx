import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HOW_IT_WORKS = [
  {
    title: "Set up in three questions",
    body: "Income, the bills you already pay, and what you're saving for. That's the whole onboarding — no category wizard, no spreadsheets.",
  },
  {
    title: "Your plan builds itself",
    body: "Every transaction you log updates what's safe to spend, how your bills are tracking, and how close your goals are — automatically.",
  },
  {
    title: "Import from Gmail",
    body: "Connect your inbox and purchase notifications from your bank import themselves, so you barely have to type anything in by hand.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompletedAt: true },
    });
    redirect(user?.onboardingCompletedAt ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <Image src="/balboa-logo.png" alt="" width={40} height={40} className="landing-brand-logo" />
          <span className="landing-brand-word">Balboa</span>
        </Link>
        <nav className="landing-nav" aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#how-it-works">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="landing-header-actions">
          <Link href="/login" className="button button--chip landing-header-login">
            Log in
          </Link>
          <Link href="/signup" className="button landing-header-cta">
            Get started
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">Built for quincena pay</span>
          <h1>Your money, planned two weeks at a time.</h1>
          <p className="landing-hero-sub">
            Balboa splits your budget the way you actually get paid. Set your income, the bills
            you already pay and what you&apos;re saving for — the rest builds up as you log it.
          </p>
          <div className="landing-hero-buttons">
            <Link href="/signup" className="button landing-cta-primary">
              Get started
            </Link>
            <Link href="/login" className="button button--chip landing-cta-secondary">
              Log in
            </Link>
          </div>
          <p className="landing-trust-line">
            <span className="landing-trust-dot" aria-hidden="true" />
            Free to start · Three questions to set up · No card required
          </p>
        </div>

        <div className="landing-hero-visual">
          {/* Desktop: a device-frame mock of the app. Mobile: replaced below
              ~900px by the flatter navy preview card (see the design
              handoff's own mobile breakpoint guidance). */}
          <div className="landing-device-mock" aria-hidden="true">
            <div className="landing-device-screen">
              <p className="landing-device-label">Left this quincena</p>
              <p className="landing-device-figure">$412.60</p>
              <div className="landing-device-rows">
                <div className="landing-device-row">
                  <span>Groceries</span>
                  <div className="landing-device-track">
                    <div className="landing-device-fill landing-device-fill--navy" style={{ width: "62%" }} />
                  </div>
                </div>
                <div className="landing-device-row">
                  <span>Transport</span>
                  <div className="landing-device-track">
                    <div className="landing-device-fill landing-device-fill--silver" style={{ width: "38%" }} />
                  </div>
                </div>
                <div className="landing-device-row">
                  <span>Savings goal</span>
                  <div className="landing-device-track">
                    <div className="landing-device-fill landing-device-fill--savings" style={{ width: "74%" }} />
                  </div>
                </div>
              </div>
              <div className="landing-device-strip">Next quincena +$1,250</div>
            </div>
          </div>

          <div className="landing-preview-card" aria-hidden="true">
            <span className="landing-preview-kicker">SAFE TO SPEND</span>
            <p className="landing-preview-figure">$207.22</p>
            <div className="landing-preview-track">
              <div className="landing-preview-fill" style={{ width: "68%" }} />
            </div>
            <span className="landing-preview-days">11 days left</span>
          </div>
        </div>
      </section>

      <section className="landing-mobile-cta">
        <Link href="/signup" className="button landing-cta-primary">
          Get started
        </Link>
        <Link href="/login" className="button button--chip landing-cta-secondary">
          Log in
        </Link>
        <p className="landing-trust-line landing-trust-line--center">
          Free to start · No card required
        </p>
      </section>

      <section id="how-it-works" className="landing-how">
        {HOW_IT_WORKS.map((item, index) => (
          <div key={item.title} className="landing-how-card">
            <span className="landing-how-number">{index + 1}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="landing-cta-band" aria-label="Get started">
        <div>
          <h2>Start with your next quincena.</h2>
          <p>Set up in minutes, and every paycheck after that plans itself.</p>
        </div>
        <div className="landing-cta-band-buttons">
          <Link href="/signup" className="button landing-cta-band-primary">
            Get started
          </Link>
          <Link href="/login" className="button landing-cta-band-secondary">
            Log in
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand landing-footer-brand">
          <Image src="/balboa-logo.png" alt="" width={26} height={26} className="landing-brand-logo" />
          <span>© 2026 Balboa</span>
        </div>
        <div className="landing-footer-links">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#support">Support</a>
        </div>
      </footer>
    </div>
  );
}
