import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [banner, setBanner] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((message) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner({ message });
    timerRef.current = setTimeout(() => setBanner(null), 5000);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner(null);
  }, []);

  const api = {
    error: (msg) => show(msg),
    success: (msg) => show(msg),
    info: (msg) => show(msg),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {banner && (
        <div
          className="sys-banner"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <span className="sys-banner-msg">{banner.message}</span>
          <button
            type="button"
            className="sys-banner-close"
            aria-label="Dismiss"
            onClick={dismiss}
          >
            &#x2715;
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
