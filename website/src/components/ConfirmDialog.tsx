"use client";

import { useEffect } from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-berry-dark">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-foreground/70">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-berry/20 px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-blush"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-berry px-4 py-2 text-sm font-semibold text-white hover:bg-berry-dark"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
