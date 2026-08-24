"use client";

import type { ToastItem } from "@/lib/toast-context";

const VARIANT_STYLES: Record<ToastItem["variant"], string> = {
  success: "bg-berry-dark",
  error: "bg-red-600",
  info: "bg-foreground",
};

export default function Toast({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={`flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg transition ${VARIANT_STYLES[t.variant]}`}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick();
                onDismiss(t.id);
              }}
              className="shrink-0 underline underline-offset-2"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
