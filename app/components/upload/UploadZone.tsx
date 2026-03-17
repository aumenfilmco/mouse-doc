"use client";
import { useRef, useState } from "react";
import { isAcceptedFileType } from "@/app/utils/fileValidation";
import ErrorBanner from "./ErrorBanner";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

export default function UploadZone({ onFilesSelected, disabled }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleZoneClick();
    }
  };

  const processFiles = (rawFiles: File[]) => {
    const valid = rawFiles.filter((f) => isAcceptedFileType(f));
    const rejected = rawFiles.filter((f) => !isAcceptedFileType(f));
    if (rejected.length > 0) {
      setTypeError("That file type isn't supported. Please select a video or audio file.");
    } else {
      setTypeError(null);
    }
    if (valid.length > 0) {
      onFilesSelected(valid);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  };

  const zoneStyle: React.CSSProperties = {
    border: dragOver ? "2px dashed #B91C1C" : "2px dashed #9CA3AF40",
    background: dragOver ? "#B91C1C08" : "#1F1F1F",
    padding: "48px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.3s",
    ...(disabled ? { pointerEvents: "none", opacity: 0.5 } : {}),
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleZoneClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={zoneStyle}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          multiple
          style={{ display: "none" }}
          onChange={handleChange}
        />
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.6 }}>🎬</div>
        <p
          style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
            fontSize: 16,
            fontWeight: 600,
            color: "#FFFFFF",
            margin: "0 0 8px",
          }}
        >
          Drop your video or voice memo here
        </p>
        <p
          style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
            fontSize: 14,
            color: "#9CA3AF",
            margin: 0,
          }}
        >
          or tap to browse — accepts video and audio files
        </p>
      </div>
      {typeError && (
        <ErrorBanner message={typeError} />
      )}
    </div>
  );
}
