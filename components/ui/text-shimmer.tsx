"use client";

import React from "react";

interface TextShimmerProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export const TextShimmer: React.FC<TextShimmerProps> = ({
  children,
  className = "",
  duration = 2,
}) => {
  return (
    <span
      className={`inline-block relative overflow-hidden ${className}`}
      style={{
        WebkitMaskImage: "linear-gradient(-60deg, #000 30%, #0005, #000 70%)",
        WebkitMaskSize: "200%",
      }}
    >
      <span className="relative z-10">{children}</span>
      <span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent"
        style={{
          backgroundSize: "200% 100%",
          animation: `shimmer ${duration}s infinite linear`,
        }}
      />
    </span>
  );
};
