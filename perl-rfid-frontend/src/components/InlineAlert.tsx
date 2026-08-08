interface InlineAlertProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: 'notice' | 'error';
}

/**
 * Consolidated mutation-feedback message: replaces the ad hoc
 * `form-message` / `form-message--error` divs pages built inline.
 * Error messages must already be safe to show (the API's own message, never a stack trace).
 */
export const InlineAlert = ({
  message,
  onRetry,
  retryLabel = 'Retry',
  tone = 'notice'
}: InlineAlertProps) => (
  <div
    className={tone === 'error' ? 'form-message form-message--error' : 'form-message'}
    role={tone === 'error' ? 'alert' : 'status'}
  >
    <span>{message}</span>
    {onRetry ? (
      <button className="text-button" type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    ) : null}
  </div>
);
