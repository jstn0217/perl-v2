import type { PropsWithChildren } from 'react';
import { useEffect, useId, useRef } from 'react';

interface ModalProps extends PropsWithChildren {
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
  variant?: 'dialog' | 'drawer';
}

export const Modal = ({
  children,
  description,
  onClose,
  open,
  title,
  variant = 'dialog'
}: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${variant}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__surface">
        <header className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button className="modal__close" type="button" onClick={onClose} aria-label={`Close ${title}`}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
};
