"use client";

import { use } from "react";
import { useFormStatus } from "react-dom";
import { googleSignInAction } from "./actions";
import { AuthShell } from "../_components/AuthShell";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = useT();
  const vocab = useVocab();
  const { error } = use(searchParams);

  return (
    <AuthShell title={t.auth.login.title} subtitle={t.auth.login.subtitle(vocab)}>
      <form action={googleSignInAction} className="auth-form">
        {error && (
          <p className="auth-error-block" role="alert">
            {t.auth.login.error}
          </p>
        )}
        <SubmitButton />
      </form>
    </AuthShell>
  );
}

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button auth-submit" disabled={pending}>
      {pending ? t.auth.login.submitting : t.auth.login.submit}
    </button>
  );
}
