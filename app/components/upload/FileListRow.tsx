"use client";

interface FileListRowProps {
  file: File;
  status: "pending" | "uploading" | "done" | "failed";
  onRemove: () => void;
}

export default function FileListRow({ file, status, onRemove }: FileListRowProps) {
  const showRemove = status !== "uploading" && status !== "done";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#2A2A2A",
        padding: "8px 16px",
        borderLeft: "3px solid #B91C1C",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        <span
          style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
            fontSize: 14,
            color: "#E8E8E8",
          }}
        >
          {file.name}
        </span>
        <span
          style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
            fontSize: 14,
            color: "#9CA3AF",
            marginLeft: 8,
          }}
        >
          {(file.size / 1024 / 1024).toFixed(1)} MB
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {status === "uploading" && (
          <span
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: 14,
              color: "#9CA3AF",
            }}
          >
            Uploading...
          </span>
        )}
        {status === "done" && (
          <span
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: 14,
              color: "#9CA3AF",
            }}
          >
            Done
          </span>
        )}
        {status === "failed" && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: 14,
                color: "#B91C1C",
                fontWeight: 600,
              }}
            >
              Failed
            </span>
            <button
              onClick={onRemove}
              style={{
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: 14,
                color: "#B91C1C",
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </span>
        )}
        {showRemove && (
          <button
            onClick={onRemove}
            style={{
              fontSize: 14,
              color: "#9CA3AF",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginLeft: 12,
            }}
          >
            {"\u00d7"}
          </button>
        )}
      </div>
    </div>
  );
}
