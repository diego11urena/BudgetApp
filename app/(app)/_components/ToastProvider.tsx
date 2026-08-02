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

  const showToast = useCallback((message: string, action?: ToastAction) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const id = ++idRef.current;
    setToast({ id, message, action });
    timeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, AUTO_DISMISS_MS);
  }, []);

  function dismiss() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }

  function handleActionClick() {
    toast?.action?.onClick();
    dismiss();
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="toast" role="status">
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
