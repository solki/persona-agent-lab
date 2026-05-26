"use client";

import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  variant = "danger",
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: "danger" | "warning";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  const confirmClass =
    variant === "danger"
      ? "bg-warning text-white hover:bg-red-700"
      : "border border-warning bg-white text-warning hover:bg-red-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded border border-line bg-white p-5 shadow-xl"
      >
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-red-50 text-warning">
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="focus-ring rounded border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`focus-ring rounded px-4 py-2 text-sm font-medium disabled:opacity-60 ${confirmClass}`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
