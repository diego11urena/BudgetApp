"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = undefined;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="card">
      <h1>Log in</h1>
      <form action={formAction}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {state?.error && <p className="error-text">{state.error}</p>}
        <div className="form-actions">
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Logging in..." : "Log in"}
          </button>
        </div>
      </form>
      <p className="muted-link">
        Don&apos;t have an account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}
