interface LoadingOverlayProps {
  /** Whether the overlay is visible. When false, the component renders nothing. */
  visible: boolean;
}

export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
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
      <style>{`
        @keyframes loading-overlay-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LoadingOverlay;
