"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type SignupFormState } from "./actions";

const initialState: SignupFormState = undefined;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div className="card">
      <h1>Create your account</h1>
      <form action={formAction}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required autoComplete="name" />
        </div>
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
            minLength={8}
            autoComplete="new-password"
          />
          <span className="field-hint">At least 8 characters.</span>
        </div>
        {state?.error && <p className="error-text">{state.error}</p>}
        <div className="form-actions">
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Creating account..." : "Sign up"}
          </button>
        </div>
      </form>
      <p className="muted-link">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
