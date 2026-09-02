"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, type ChangePasswordFormState } from "../actions";
import { useT } from "../../../_components/LocaleProvider";

const initialState: ChangePasswordFormState = undefined;

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const t = useT();

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="current-password">{t.profile.changePassword.currentLabel}</label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="new-password">{t.profile.changePassword.newLabel}</label>
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
        <label htmlFor="confirm-password">{t.profile.changePassword.confirmLabel}</label>
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
            {t.profile.changePassword.mismatch}
          </span>
        )}
      </div>

      {!!state && "error" in state && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
      {!!state && "success" in state && (
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          {t.profile.changePassword.updated}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending || mismatch}>
          {pending ? t.profile.changePassword.saving : t.profile.changePassword.submit}
        </button>
      </div>
    </form>
  );
}
