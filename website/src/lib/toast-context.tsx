"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Toast from "@/components/Toast";

export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
};

type ShowToastOptions = {
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (message: string, options?: ShowToastOptions) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message: string, options?: ShowToastOptions) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [
      ...prev,
      { id, message, variant: options?.variant ?? "success", action: options?.action },
    ]);
    setTimeout(() => dismissToast(id), options?.durationMs ?? 4000);
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
