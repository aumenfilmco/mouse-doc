"use client";

interface ProgressBarProps {
  progress: number;
  status: "idle" | "uploading" | "complete" | "error";
}

export default function ProgressBar({ progress, status }: ProgressBarProps) {
  const isHidden = status === "idle" && progress === 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ display: isHidden ? "none" : "block" }}
    >
      <div
        style={{
          width: "100%",
          height: 4,
          background: "#2A2A2A",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: 4,
            background: "#B91C1C",
            transition: "width 0.1s linear",
          }}
        />
      </div>
      <p
        style={{
          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
          fontSize: 14,
          fontWeight: 400,
          color: "#9CA3AF",
          textAlign: "right",
          marginTop: 4,
          margin: "4px 0 0 0",
        }}
      >
        {progress}% uploaded
      </p>
    </div>
  );
}
