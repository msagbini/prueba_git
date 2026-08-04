import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A form dialog built on the native `<dialog>` element — `showModal()`
 * gives us a focus trap, Escape-to-close and a backdrop for free, instead
 * of hand-rolling that accessibility behavior.
 * @param props the dialog's open state, close handler, title, and content
 * @param props.open whether the dialog should be open
 * @param props.onClose called on close (the X button, Escape, or a backdrop click)
 * @param props.title the dialog's heading
 * @param props.children the dialog's body content
 * @returns the dialog element
 */
export function Modal({ open, onClose, title, children }: ModalProps): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="w-full max-w-lg rounded-lg border border-gray-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          ✕
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
