"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail } from "lucide-react";
import { loginAction, type LoginFormState } from "./actions";
import { AuthShell } from "../_components/AuthShell";

const initialState: LoginFormState = undefined;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShell title="Welcome back." subtitle="Log in to pick up this quincena.">
      <form action={formAction} className="auth-form">
        <div className="field">
          <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
            <Link href="/forgot-password" className="auth-forgot-link">
              Forgot?
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
              aria-label={showPassword ? "Hide password" : "Show password"}
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
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      {/* UI only for now -- see the "wire real Gmail OAuth sign-in" follow-up
          task: reusing the Gmail-import app for sign-in needs a new
          redirect URI registered in Google Cloud Console and a decision on
          scope, neither of which this pass makes. */}
      <button type="button" className="auth-gmail-button" disabled title="Coming soon">
        <Mail size={19} aria-hidden="true" />
        Continue with Gmail
      </button>

      <p className="auth-bottom-link">
        New to Balboa? <Link href="/signup">Create an account</Link>
      </p>
    </AuthShell>
  );
}
