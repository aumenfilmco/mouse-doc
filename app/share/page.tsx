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

export default function SharePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<
    Record<number, "pending" | "uploading" | "done" | "failed">
  >({});
  const [hoverSubmit, setHoverSubmit] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState(false);
  const [isMetadataPosting, setIsMetadataPosting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    setNameError(null);
    setEmailError(null);
    setMetadataError(false);

    // Validate required fields
    let hasError = false;
    if (!name.trim()) {
      setNameError("Please enter your name.");
      hasError = true;
    }
    if (email && !email.includes("@")) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    }
    if (files.length === 0) {
      return; // Button should be disabled, but guard anyway
    }
    if (hasError) return;

    let localFileKey = "";

    const filesToUpload = files
      .map((f, i) => [i, f] as [number, File])
      .filter(([i]) => fileStatuses[i] === "pending" || fileStatuses[i] === "failed");

    for (const [index, file] of filesToUpload) {
      setFileStatuses((prev) => ({ ...prev, [index]: "uploading" }));
      const key = await upload(file);
      if (key) {
        setFileStatuses((prev) => ({ ...prev, [index]: "done" }));
        localFileKey = key;
        setFileKey(key);
      } else {
        setFileStatuses((prev) => ({ ...prev, [index]: "failed" }));
        return;
      }
    }

    // Metadata POST
    setIsMetadataPosting(true);
    try {
      const res = await fetch("/api/submit/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relation: "Typeform submission — file upload",
          email,
          phone: "",
          textStory: "",
          fileKey: localFileKey,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        setMetadataError(true);
      }
    } catch {
      setMetadataError(true);
    } finally {
      setIsMetadataPosting(false);
    }
  };

  const handleMetadataRetry = async () => {
    setMetadataError(false);
    setIsMetadataPosting(true);
    try {
      const res = await fetch("/api/submit/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relation: "Typeform submission — file upload",
          email,
          phone: "",
          textStory: "",
          fileKey: fileKey || "",
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setMetadataError(true);
      }
    } catch {
      setMetadataError(true);
    } finally {
      setIsMetadataPosting(false);
    }
  };

  const isUploading = status === "uploading";
  const isDisabled = isUploading || isMetadataPosting || files.length === 0;

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

  const inputStyle: React.CSSProperties = {
    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
    fontSize: 16,
    padding: "12px 16px",
    background: COLORS.midGray,
    border: `1px solid ${COLORS.warmGray}30`,
    color: COLORS.white,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const errorTextStyle: React.CSSProperties = {
    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.red,
    margin: "4px 0 0",
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;0,900;1,400;1,700&family=Source+Sans+3:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${COLORS.black}; }
        ::selection { background: ${COLORS.red}40; color: ${COLORS.white}; }
        input::placeholder { color: ${COLORS.warmGray}80; }
        @media (max-width: 600px) {
          input[type="text"] { font-size: 14px !important; }
        }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header / Branding */}
        <header
          style={{
            background: COLORS.black,
            padding: "40px 24px 0",
            textAlign: "center",
          }}
        >
          <a href="/" style={{ textDecoration: "none" }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 32,
                fontWeight: 900,
                color: COLORS.white,
                letterSpacing: "0.06em",
                margin: 0,
              }}
            >
              MOUSE
            </h1>
            <p
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 14,
                color: COLORS.red,
                fontStyle: "italic",
                margin: "4px 0 0",
              }}
            >
              50 Years on the Mat
            </p>
          </a>
        </header>

        {/* Upload Section */}
        <section
          style={{
            background: COLORS.darkGray,
            padding: "60px 24px 100px",
            flex: 1,
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
                SHARE A MEMORY
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
                Share a Memory
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
                Record a quick video or voice memo about your experience with Coach McCollum
                and upload it below. A favorite memory, what he meant to you, or a story
                nobody else knows.
              </p>
            </FadeIn>

            {!submitted ? (
              <FadeIn delay={0.3}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Name + Email */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div>
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-label="Your Name"
                        aria-required="true"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                        onBlur={(e) => {
                          e.target.style.borderColor = `${COLORS.warmGray}30`;
                          setNameError(null);
                        }}
                      />
                      {nameError && (
                        <p role="alert" style={errorTextStyle}>
                          {nameError}
                        </p>
                      )}
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-label="Email address"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                        onBlur={(e) => {
                          e.target.style.borderColor = `${COLORS.warmGray}30`;
                          if (email && !email.includes("@")) {
                            setEmailError("Please enter a valid email address.");
                          } else {
                            setEmailError(null);
                          }
                        }}
                      />
                      {emailError && (
                        <p role="alert" style={errorTextStyle}>
                          {emailError}
                        </p>
                      )}
                    </div>
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

                  {/* Error banner (upload errors) */}
                  {error && (
                    <ErrorBanner
                      message={error}
                      onRetry={() => {
                        reset();
                      }}
                    />
                  )}

                  {/* Metadata error banner */}
                  {metadataError && (
                    <div
                      role="alert"
                      style={{
                        background: `${COLORS.darkRed}20`,
                        border: `1px solid ${COLORS.red}`,
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.red,
                        }}
                      >
                        We couldn&apos;t save your submission. Your file is safe — please try again.
                      </span>
                      <button
                        onClick={handleMetadataRetry}
                        disabled={isMetadataPosting}
                        style={{
                          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.red,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isDisabled}
                    style={submitButtonStyle}
                    onMouseEnter={() => setHoverSubmit(true)}
                    onMouseLeave={() => setHoverSubmit(false)}
                  >
                    {isUploading
                      ? "UPLOADING..."
                      : isMetadataPosting
                        ? "SAVING..."
                        : "UPLOAD YOUR MEMORY"}
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
                    Your memory matters. We&apos;ll review your submission and may reach out to
                    schedule a formal interview for the film.
                  </p>
                </div>
              </FadeIn>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            background: COLORS.black,
            padding: "60px 24px 40px",
            borderTop: `3px solid ${COLORS.red}`,
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <p
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 18,
                color: COLORS.white,
                fontWeight: 700,
                margin: "0 0 4px",
              }}
            >
              MOUSE
            </p>
            <p
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 14,
                color: COLORS.red,
                fontStyle: "italic",
                margin: "0 0 24px",
              }}
            >
              50 Years on the Mat
            </p>
            <div
              style={{
                width: 40,
                height: 1,
                background: COLORS.warmGray + "40",
                margin: "0 auto 24px",
              }}
            />
            <p
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                color: COLORS.warmGray,
                margin: "0 0 6px",
              }}
            >
              Produced by Aumen Film Co. • York Springs, PA
            </p>
            <p
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 12,
                color: COLORS.warmGray + "80",
                margin: 0,
              }}
            >
              © 2026 Aumen Film Co. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
