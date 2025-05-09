"use client";

import * as React from "react";
import { useEffect, useState } from "react";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

interface ToastContextType {
  toast: (props: ToastProps) => void;
  dismiss: (id?: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([]);

  const toast = (props: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...props, id }]);

    // Auto dismiss
    if (props.duration !== 0) {
      setTimeout(() => {
        dismiss(id);
      }, props.duration || 3000);
    }
  };

  const dismiss = (id?: string) => {
    if (id) {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    } else {
      setToasts([]);
    }
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-md p-4 shadow-md animate-in fade-in slide-in-from-bottom-5 ${
                toast.variant === "destructive"
                  ? "bg-red-50 text-red-900 border border-red-200"
                  : "bg-white text-gray-900 border border-gray-200"
              }`}
            >
              {toast.title && (
                <div className="font-medium mb-1">{toast.title}</div>
              )}
              {toast.description && <div>{toast.description}</div>}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Re-export as toast for convenience
export const toast = (props: ToastProps) => {
  // This will throw an error if used outside a provider, which is fine
  // as it helps developers understand they need to wrap their app with ToastProvider
  try {
    const { toast } = useToast();
    toast(props);
  } catch (e) {
    console.error("Toast error:", e);
    console.warn("Make sure your application is wrapped in ToastProvider");
  }
}; 