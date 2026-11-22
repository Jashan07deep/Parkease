import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Native <dialog>: focus trap, Esc to close and backdrop come for free.
export default function Dialog({ title, onClose, children, dismissible = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose?.(); }}
      onClick={(e) => { if (dismissible && e.target === ref.current) onClose?.(); }}
    >
      <div className="dialog__head">
        <h2>{title}</h2>
        {dismissible && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>}
      </div>
      <div className="dialog__body">{children}</div>
    </dialog>
  );
}
