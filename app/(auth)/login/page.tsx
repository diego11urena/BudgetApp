"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail } from "lucide-react";
import { loginAction, type LoginFormState } from "./actions";
import { AuthShell } from "../_components/AuthShell";
import { useT } from "@/app/_components/LocaleProvider";

const initialState: LoginFormState = undefined;

export default function LoginPage() {
  const t = useT();
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShell title={t.auth.login.title} subtitle={t.auth.login.subtitle}>
      <form action={formAction} className="auth-form">
        <div className="field">
          <label htmlFor="email">{t.auth.login.emailLabel}</label>
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
          <div className="auth-password-label-row">
            <label htmlFor="password">{t.auth.login.passwordLabel}</label>
            <Link href="/forgot-password" className="auth-forgot-link">
              {t.auth.login.forgot}
            </Link>
          </div>
          <div className="auth-password-wrap">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t.auth.login.hidePassword : t.auth.login.showPassword}
            >
              {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {state?.error && (
          <p className="auth-error-block" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button auth-submit" disabled={pending || !email || !password}>
          {pending ? t.auth.login.submitting : t.auth.login.submit}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t.auth.login.or}</span>
      </div>

      {/* UI only for now -- see the "wire real Gmail OAuth sign-in" follow-up
          task: reusing the Gmail-import app for sign-in needs a new
          redirect URI registered in Google Cloud Console and a decision on
          scope, neither of which this pass makes. */}
      <button type="button" className="auth-gmail-button" disabled title={t.auth.login.gmailComingSoon}>
        <Mail size={19} aria-hidden="true" />
        {t.auth.login.gmailButton}
      </button>

      <p className="auth-bottom-link">
        {t.auth.login.newToBalboa}
        <Link href="/signup">{t.auth.login.createAccount}</Link>
      </p>
    </AuthShell>
  );
}
