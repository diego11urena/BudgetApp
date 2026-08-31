"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction, type SignupFormState } from "./actions";
import { AuthShell } from "../_components/AuthShell";

const initialState: SignupFormState = undefined;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthShell title="Start your first quincena." subtitle="Two minutes to set up.">
      <form action={formAction} className="auth-form">
        <div className="field">
          <label htmlFor="name">Name</label>
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
          <label htmlFor="password">Password</label>
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
          <span className="field-hint">At least 8 characters.</span>
        </div>

        {state?.error && (
          <p className="auth-error-block" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button auth-submit" disabled={pending || !name || !email || !password}>
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="auth-bottom-link">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
