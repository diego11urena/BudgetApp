"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;
// A toast with an actionable "Undo" gets longer, and can be paused
// entirely by hovering/focusing it -- WCAG 2.2.1 Timing Adjustable,
// since the auto-dismiss would otherwise take the one chance to act
// away from someone who's still reading or reaching for it.
const AUTO_DISMISS_WITH_ACTION_MS = 10000;

/**
 * A single bottom toast, mounted once at the app shell so any page can
 * surface feedback for an action without a blocking confirm dialog. Only
 * one toast is shown at a time — a new one replaces whatever's showing,
 * which matches the app's fast-moving log/delete/undo flows better than a
 * stacked queue would.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);
  // Remaining time left when a hover/focus pause interrupts the timer, so
  // resuming continues from where it left off instead of granting a full
  // fresh window every time the pointer passes over the toast.
  const remainingMsRef = useRef(0);
  const startedAtRef = useRef(0);

  const armTimer = useCallback((id: number, ms: number) => {
    startedAtRef.current = Date.now();
    remainingMsRef.current = ms;
    timeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, ms);
  }, []);

  const showToast = useCallback(
    (message: string, action?: ToastAction) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const id = ++idRef.current;
      setToast({ id, message, action });
      armTimer(id, action ? AUTO_DISMISS_WITH_ACTION_MS : AUTO_DISMISS_MS);
    },
    [armTimer],
  );

  function dismiss() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }

  function handleActionClick() {
    toast?.action?.onClick();
    dismiss();
  }

  function pause() {
    if (!toast || !timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    remainingMsRef.current -= Date.now() - startedAtRef.current;
  }

  function resume() {
    if (!toast || remainingMsRef.current <= 0) return;
    armTimer(toast.id, remainingMsRef.current);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="toast"
          role="status"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
        >
          <span className="toast-message">{toast.message}</span>
          {toast.action && (
            <>
              <span className="toast-sep">·</span>
              <button type="button" className="toast-action" onClick={handleActionClick}>
                {toast.action.label}
              </button>
            </>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
