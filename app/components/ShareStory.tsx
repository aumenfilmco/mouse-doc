"use client";
import { useState, useEffect, useRef } from "react";
import { useFileUpload } from "@/app/hooks/useFileUpload";
import UploadZone from "@/app/components/upload/UploadZone";
import ProgressBar from "@/app/components/upload/ProgressBar";
import FileListRow from "@/app/components/upload/FileListRow";
import ErrorBanner from "@/app/components/upload/ErrorBanner";
import { validateSubmission } from "@/app/utils/validateSubmission";

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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [textStory, setTextStory] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<
    Record<number, "pending" | "uploading" | "done" | "failed">
  >({});
  const [hoverSubmit, setHoverSubmit] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [form06Error, setForm06Error] = useState<string | null>(null);
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
    // Clear previous errors
    setNameError(null);
    setRelationError(null);
    setEmailError(null);
    setForm06Error(null);
    setMetadataError(false);

    // Client-side validation
    const validation = validateSubmission({
      name,
      relation,
      email,
      phone,
      textStory,
      hasFile: files.length > 0,
    });

    if (!validation.valid) {
      if (validation.errors.name) setNameError(validation.errors.name);
      if (validation.errors.relation) setRelationError(validation.errors.relation);
      if (validation.errors.email) setEmailError(validation.errors.email);
      if (validation.errors.form06) setForm06Error(validation.errors.form06);
      return;
    }

    // CRITICAL: Capture fileKey from upload() return value, NOT from React state (stale closure risk)
    let localFileKey = "";

    // File upload path
    if (files.length > 0) {
      const filesToUpload = files
        .map((f, i) => [i, f] as [number, File])
        .filter(([i]) => fileStatuses[i] === "pending" || fileStatuses[i] === "failed");

      for (const [index, file] of filesToUpload) {
        setFileStatuses((prev) => ({ ...prev, [index]: "uploading" }));
        const key = await upload(file);
        if (key) {
          setFileStatuses((prev) => ({ ...prev, [index]: "done" }));
          localFileKey = key; // Capture directly — not from state
          setFileKey(key); // Also store in state for retry handler
        } else {
          setFileStatuses((prev) => ({ ...prev, [index]: "failed" }));
          return; // Stop on first upload failure — ErrorBanner from useFileUpload will show
        }
      }
    }

    // Metadata POST (both file and text-only paths converge here)
    setIsMetadataPosting(true);
    try {
      const res = await fetch("/api/submit/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relation,
          email,
          phone,
          textStory,
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
          relation,
          email,
          phone,
          textStory,
          fileKey: fileKey || "", // Use React state fileKey as fallback for retry
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
  const isDisabled = isUploading || isMetadataPosting || (files.length === 0 && textStory.trim().length === 0);

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
              {/* Row 1: Name + relation inputs */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
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
                  {nameError && <p role="alert" style={errorTextStyle}>{nameError}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Your connection to Coach McCollum"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    aria-label="Your connection to Coach McCollum"
                    aria-required="true"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                    onBlur={(e) => {
                      e.target.style.borderColor = `${COLORS.warmGray}30`;
                      setRelationError(null);
                    }}
                  />
                  {relationError && <p role="alert" style={errorTextStyle}>{relationError}</p>}
                </div>
              </div>

              {/* Row 2: Email + phone inputs */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <input
                    type="email"
                    placeholder="Email address (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email address (optional)"
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
                  {emailError && <p role="alert" style={errorTextStyle}>{emailError}</p>}
                </div>
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-label="Phone number (optional)"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                  onBlur={(e) => (e.target.style.borderColor = `${COLORS.warmGray}30`)}
                />
              </div>

              {/* Row 3: Textarea */}
              <textarea
                placeholder="Type your story here — a memory, what he meant to you, something only you know."
                value={textStory}
                onChange={(e) => { setTextStory(e.target.value); if (form06Error) setForm06Error(null); }}
                aria-label="Your story"
                style={{
                  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                  fontSize: 16,
                  lineHeight: 1.7,
                  padding: "12px 16px",
                  background: COLORS.midGray,
                  border: `1px solid ${COLORS.warmGray}30`,
                  color: COLORS.white,
                  outline: "none",
                  minHeight: 120,
                  resize: "vertical" as const,
                  width: "100%",
                  boxSizing: "border-box" as const,
                }}
                onFocus={(e) => (e.target.style.borderColor = COLORS.red)}
                onBlur={(e) => (e.target.style.borderColor = `${COLORS.warmGray}30`)}
              />

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

              {/* MetadataErrorBanner */}
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
                  <span style={{
                    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.red,
                  }}>
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

              {/* FORM-06 validation error */}
              {form06Error && (
                <p role="alert" style={{
                  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: COLORS.red,
                  margin: 0,
                }}>
                  {form06Error}
                </p>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                style={submitButtonStyle}
                onMouseEnter={() => setHoverSubmit(true)}
                onMouseLeave={() => setHoverSubmit(false)}
              >
                {isUploading ? "UPLOADING..." : isMetadataPosting ? "SAVING..." : "SUBMIT YOUR STORY"}
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
