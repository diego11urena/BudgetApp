"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { googleSignInAction } from "./actions";
import { AuthShell } from "../_components/AuthShell";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = useT();
  const vocab = useVocab();
  const { error } = use(searchParams);
  const [agreed, setAgreed] = useState(false);

  return (
    <AuthShell title={t.auth.login.title} subtitle={t.auth.login.subtitle(vocab)}>
      <form action={googleSignInAction} className="auth-form">
        {error && (
          <p className="auth-error-block" role="alert">
            {error === "terms" ? t.auth.login.termsRequired : t.auth.login.error}
          </p>
        )}
        <label className="auth-terms">
          <input
            type="checkbox"
            name="terms"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            {t.auth.login.agreeBefore}
            <Link href="/terms" target="_blank">
              {t.auth.login.termsLink}
            </Link>
            {t.auth.login.agreeAnd}
            <Link href="/privacy" target="_blank">
              {t.auth.login.privacyLink}
            </Link>
          </span>
        </label>
        <SubmitButton disabled={!agreed} />
      </form>
    </AuthShell>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button auth-submit" disabled={disabled || pending}>
      {pending ? t.auth.login.submitting : t.auth.login.submit}
    </button>
  );
}
