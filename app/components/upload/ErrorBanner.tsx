"use client";
import { useEffect, useState } from "react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role="alert"
      style={{
        background: "#7F1D1D20",
        border: "1px solid #B91C1C",
        padding: "12px 16px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
      }}
    >
      <span
        style={{
          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: "#B91C1C",
        }}
      >
        {message}
      </span>
      {onRetry && (
        <>
          {" "}
          <button
            onClick={onRetry}
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "#B91C1C",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
