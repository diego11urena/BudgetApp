"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginFormState } from "./actions";
import { AuthShell } from "../_components/AuthShell";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

const initialState: LoginFormState = undefined;

export default function LoginPage() {
  const t = useT();
  const vocab = useVocab();
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShell title={t.auth.login.title} subtitle={t.auth.login.subtitle(vocab)}>
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

      {/* "Continue with Gmail" lived here as a permanently disabled
          button. Removed rather than wired: this app's Auth.js config has
          only a Credentials provider, and the /api/gmail/* routes connect
          Gmail FOR IMPORT to an already-signed-in user -- they are not a
          sign-in path. Turning this into a real control needs a Google
          auth provider, a redirect URI registered in Google Cloud
          Console, and a decision about linking a Google identity to an
          existing credentials account. That is a feature, not wiring, and
          a dead button in the meantime teaches people the app is broken.
          Gmail import is still offered on Profile, where it applies. The
          "or" divider went with it -- it existed only to separate the
          form from this button. */}

      <p className="auth-bottom-link">
        {t.auth.login.newToBalboa}
        <Link href="/signup">{t.auth.login.createAccount}</Link>
      </p>
    </AuthShell>
  );
}
