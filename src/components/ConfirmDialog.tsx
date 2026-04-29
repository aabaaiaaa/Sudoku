/**
 * `<ConfirmDialog>` is the in-app replacement for `window.confirm`, used by
 * `<Home>` for save-replacement prompts and by `<App>` for the migration
 * prompt (requirements §5.4).
 */
import type React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      data-testid="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        className="card p-6 min-w-[260px] max-w-sm shadow-xl"
        style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold mb-3">
          {title}
        </h2>
        <div className="text-sm mb-4 opacity-90">{body}</div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="confirm-dialog-confirm"
            onClick={onConfirm}
            className="btn btn-primary"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-dialog-cancel"
            onClick={onCancel}
            className="btn"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
