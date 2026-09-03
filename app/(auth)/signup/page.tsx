"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction, type SignupFormState } from "./actions";
import { AuthShell } from "../_components/AuthShell";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

const initialState: SignupFormState = undefined;

export default function SignupPage() {
  const t = useT();
  const vocab = useVocab();
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthShell title={t.auth.signup.title(vocab)} subtitle={t.auth.signup.subtitle}>
      <form action={formAction} className="auth-form">
        <div className="field">
          <label htmlFor="name">{t.auth.signup.nameLabel}</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
          />
        </div>
        <div className="field">
          <label htmlFor="email">{t.auth.signup.emailLabel}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t.auth.signup.passwordLabel}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
          <span className="field-hint">{t.auth.signup.passwordHint}</span>
        </div>

        {state?.error && (
          <p className="auth-error-block" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button auth-submit" disabled={pending || !name || !email || !password}>
          {pending ? t.auth.signup.submitting : t.auth.signup.submit}
        </button>
      </form>

      <p className="auth-bottom-link">
        {t.auth.signup.alreadyHaveAccount}
        <Link href="/login">{t.auth.signup.logIn}</Link>
      </p>
    </AuthShell>
  );
}
