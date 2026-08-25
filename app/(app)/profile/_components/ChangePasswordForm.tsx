"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, type ChangePasswordFormState } from "../actions";

const initialState: ChangePasswordFormState = undefined;

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={mismatch ? "is-invalid" : ""}
          aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? "confirm-password-error" : undefined}
        />
        {mismatch && (
          <span id="confirm-password-error" className="error-text" role="alert">
            Passwords don&apos;t match
          </span>
        )}
      </div>

      {state?.error && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          Password updated.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending || mismatch}>
          {pending ? "Saving..." : "Change password"}
        </button>
      </div>
    </form>
  );
}
