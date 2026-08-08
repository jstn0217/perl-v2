import { useEffect, useRef } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: 'default' | 'danger';
}

/**
 * Reusable window.confirm replacement. Names the affected record in the title/description,
 * and (via the native <dialog> element inside Modal) restores focus to whichever element
 * triggered it once closed.
 */
export const ConfirmDialog = ({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  description,
  onCancel,
  onConfirm,
  open,
  title,
  tone = 'default'
}: ConfirmDialogProps) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <Modal description={description} onClose={onCancel} open={open} title={title}>
      <div className="form-actions">
        <button
          ref={confirmButtonRef}
          className={tone === 'danger' ? 'secondary-button secondary-button--danger' : 'primary-button'}
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
};
