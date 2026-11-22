import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const push = useCallback((text, kind = 'ok') => {
    const key = ++id.current;
    setItems((l) => [...l, { key, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.key !== key)), kind === 'error' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.key} className={`toast toast--${t.kind}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}
