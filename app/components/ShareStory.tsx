"use client";
import { useState, useEffect, useRef } from "react";
import { useFileUpload } from "@/app/hooks/useFileUpload";
import UploadZone from "@/app/components/upload/UploadZone";
import ProgressBar from "@/app/components/upload/ProgressBar";
import FileListRow from "@/app/components/upload/FileListRow";
import ErrorBanner from "@/app/components/upload/ErrorBanner";

const COLORS = {
  black: "#111111",
  darkGray: "#1A1A1A",
  midGray: "#2A2A2A",
  cardGray: "#1F1F1F",
  warmGray: "#9CA3AF",
  lightGray: "#E8E8E8",
  offWhite: "#F5F5F5",
  white: "#FFFFFF",
  red: "#B91C1C",
  darkRed: "#7F1D1D",
};

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView() as [React.RefObject<HTMLDivElement>, boolean];
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function RedBar({ width = 80, style = {} }: { width?: number; style?: React.CSSProperties }) {
  return <div style={{ width, height: 3, background: COLORS.red, ...style }} />;
}

export default function ShareStory() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<
    Record<number, "pending" | "uploading" | "done" | "failed">
  >({});
  const [hoverSubmit, setHoverSubmit] = useState(false);

  const { upload, progress, status, error, reset } = useFileUpload();

  const handleFileSelection = (newFiles: File[]) => {
    setFiles((prev) => {
      const startIndex = prev.length;
      const statuses: Record<number, "pending"> = {};
      newFiles.forEach((_, i) => {
        statuses[startIndex + i] = "pending";
      });
      setFileStatuses((prevStatuses) => ({ ...prevStatuses, ...statuses }));
      return [...prev, ...newFiles];
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileStatuses((prev) => {
      const next: Record<number, "pending" | "uploading" | "done" | "failed"> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = Number(key);
        if (k < index) next[k] = val;
        else if (k > index) next[k - 1] = val;
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    const filesToUpload = files
      .map((f, i) => [i, f] as [number, File])
      .filter(([i]) => fileStatuses[i] === "pending" || fileStatuses[i] === "failed");

    for (const [index, file] of filesToUpload) {
      setFileStatuses((prev) => ({ ...prev, [index]: "uploading" }));
      const key = await upload(file);
      if (key) {
        setFileStatuses((prev) => ({ ...prev, [index]: "done" }));
        setFileKey(key);
      } else {
        setFileStatuses((prev) => ({ ...prev, [index]: "failed" }));
      }
    }

    // After all files processed: if all done, show confirmation
    const updatedStatuses = { ...fileStatuses };
    filesToUpload.forEach(([index, file]) => {
      // We'll check from the state update that happened above
      // The setSubmitted call needs to happen after all uploads
    });

    // Check after loop — use functional check via setTimeout to read latest state
    setTimeout(() => {
      setFileStatuses((prev) => {
        const allDone =
          files.length > 0 && files.every((_, i) => prev[i] === "done");
        if (allDone) {
          setSubmitted(true);
        }
        return prev;
      });
    }, 0);
  };

  const isUploading = status === "uploading";
  const isDisabled = isUploading || files.length === 0;

  const submitButtonStyle: React.CSSProperties = {
    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: COLORS.white,
    background: hoverSubmit && !isDisabled ? COLORS.darkRed : COLORS.red,
    border: "none",
    padding: "16px 40px",
    cursor: isDisabled ? "not-allowed" : "pointer",
    alignSelf: "flex-start",
    transition: "background 0.3s",
    opacity: isDisabled ? 0.4 : 1,
  };

  return (
    <section
      id="story"
      style={{
        background: COLORS.darkGray,
        padding: "100px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Noise texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div style={{ maxWidth: 700, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: COLORS.red,
              marginBottom: 16,
            }}
          >
            SHARE YOUR STORY
          </p>
          <RedBar />
        </FadeIn>
        <FadeIn delay={0.15}>
          <h2
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(26px, 4vw, 38px)",
              fontWeight: 800,
              color: COLORS.white,
              lineHeight: 1.2,
              margin: "28px 0 16px",
            }}
          >
            Were you coached by Mouse?
          </h2>
          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: 16,
              color: COLORS.warmGray,
              lineHeight: 1.7,
              marginBottom: 36,
            }}
          >
            We&apos;re collecting stories from former wrestlers, students, colleagues, and community
            members to help shape this documentary. Grab your phone, record a quick video or voice
            memo, and upload it here. Tell us your favorite memory, what Coach McCollum meant to
            you, or a story nobody else knows.
          </p>
        </FadeIn>
        {!submitted ? (
          <FadeIn delay={0.3}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Name + relation inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                    fontSize: 15,
                    padding: "14px 16px",
                    background: COLORS.midGray,
                    border: `1px solid ${COLORS.warmGray}30`,
                    color: COLORS.white,
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                  onBlur={(e) => (e.target.style.borderColor = `${COLORS.warmGray}30`)}
                />
                <input
                  type="text"
                  placeholder="Your connection to Coach McCollum"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  style={{
                    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                    fontSize: 15,
                    padding: "14px 16px",
                    background: COLORS.midGray,
                    border: `1px solid ${COLORS.warmGray}30`,
                    color: COLORS.white,
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                  onBlur={(e) => (e.target.style.borderColor = `${COLORS.warmGray}30`)}
                />
              </div>

              {/* Upload zone */}
              <UploadZone onFilesSelected={handleFileSelection} disabled={isUploading} />

              {/* File list */}
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {files.map((f, i) => (
                    <FileListRow
                      key={i}
                      file={f}
                      status={fileStatuses[i] || "pending"}
                      onRemove={() => handleRemoveFile(i)}
                    />
                  ))}
                </div>
              )}

              {/* Progress bar */}
              <ProgressBar progress={progress} status={status} />

              {/* Error banner */}
              {error && (
                <ErrorBanner
                  message={error}
                  onRetry={() => {
                    reset();
                  }}
                />
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                style={submitButtonStyle}
                onMouseEnter={() => setHoverSubmit(true)}
                onMouseLeave={() => setHoverSubmit(false)}
              >
                {isUploading ? "UPLOADING..." : "SUBMIT YOUR STORY"}
              </button>

              {/* Permission disclaimer */}
              <p
                style={{
                  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                  fontSize: 12,
                  color: COLORS.warmGray,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                By uploading, you grant permission for your story to be considered as research
                material for the documentary. We may reach out to schedule a formal interview.
              </p>
            </div>
          </FadeIn>
        ) : (
          <FadeIn>
            <div
              style={{
                background: COLORS.cardGray,
                padding: "48px 32px",
                borderLeft: `4px solid ${COLORS.red}`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
              <h3
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 24,
                  color: COLORS.white,
                  margin: "0 0 12px",
                }}
              >
                Thank you{name ? `, ${name}` : ""}.
              </h3>
              <p
                style={{
                  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                  fontSize: 15,
                  color: COLORS.warmGray,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Your story matters. We&apos;ll review your submission and may reach out to schedule
                a formal interview for the film.
              </p>
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
