"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border border-gray-200 p-4 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
  {
    variants: {
      variant: {
        default: "border bg-white text-gray-950",
        destructive:
          "destructive group border-red-500 bg-red-100 text-red-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string;
  description?: string;
  duration?: number;
  variant?: "default" | "destructive";
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={toastVariants({ variant })}
        {...props}
      >
        <div className="grid gap-1">
          {title && <div className="text-sm font-semibold">{title}</div>}
          {description && (
            <div className="text-sm opacity-90">{description}</div>
          )}
        </div>
      </div>
    );
  }
);
Toast.displayName = "Toast";

export { Toast, toastVariants }; 