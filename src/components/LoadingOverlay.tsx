import { useEffect, useState } from 'react';

/**
 * Threshold (ms) after which the Cancel button + tip fade in below the
 * spinner. Per requirements §7.2.
 */
const CANCEL_DELAY_MS = 10_000;

interface LoadingOverlayProps {
  /** Whether the overlay is visible. When false, the component renders nothing. */
  visible: boolean;
  /**
   * Called when the user clicks the Cancel button (which appears only after
   * {@link CANCEL_DELAY_MS} of continuous visibility). The handler is expected
   * to cancel the in-flight generation and navigate back to Home.
   */
  onCancel?: () => void;
}

export function LoadingOverlay({ visible, onCancel }: LoadingOverlayProps) {
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (!visible) {
      // Reset so a subsequent reappearance has to wait the full 10s again.
      setShowCancel(false);
      return;
    }
    const id = window.setTimeout(() => setShowCancel(true), CANCEL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        data-testid="loading-spinner"
        style={{
          width: '3rem',
          height: '3rem',
          border: '4px solid rgba(255,255,255,0.25)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'loading-overlay-spin 0.8s linear infinite',
        }}
      />
      {showCancel && (
        <div
          data-testid="loading-cancel-actions"
          className="flex flex-col items-center gap-2 text-center px-4"
          style={{ animation: 'loading-overlay-fade-in 0.3s ease-out both' }}
        >
          <p
            data-testid="loading-cancel-note"
            className="text-sm opacity-80"
            style={{ maxWidth: '20rem' }}
          >
            Higher difficulties can take longer to generate.
          </p>
          <button
            type="button"
            data-testid="loading-cancel"
            onClick={() => onCancel?.()}
            className="btn"
          >
            Cancel
          </button>
        </div>
      )}
      <style>{`
        @keyframes loading-overlay-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes loading-overlay-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default LoadingOverlay;
