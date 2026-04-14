import React from 'react';

export const ToastContext = React.createContext(null);

export function useToast() {
  const [toasts, setToasts] = React.useState([]);

  const add = React.useCallback((msg, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, msg, type }]);
    setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, duration);
  }, []);

  return { toasts, add };
}

export function useToastCtx() {
  return React.useContext(ToastContext);
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;

  const accent = {
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const background = {
    success: '#065f46',
    danger: '#7f1d1d',
    warning: '#78350f',
    info: '#1e3a5f',
  };

  const prefix = {
    success: '[OK]',
    danger: '[ERR]',
    warning: '[WARN]',
    info: '[INFO]',
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((toast) => {
        const type = toast.type || 'info';
        return (
          <div
            key={toast.id}
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              minWidth: 260,
              maxWidth: 380,
              background: background[type] || background.info,
              color: '#fff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              borderLeft: `4px solid ${accent[type] || accent.info}`,
              fontSize: 14,
              animation: 'slideIn 0.2s ease',
            }}
          >
            <span style={{ fontWeight: 700, marginRight: 8 }}>{prefix[type] || prefix.info}</span>
            {toast.msg}
          </div>
        );
      })}
    </div>
  );
}
