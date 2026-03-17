"use client";
import { useState, useEffect, useRef } from "react";
import ShareStory from "@/app/components/ShareStory";

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
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
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

// ─── HERO ───
function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);
  return (
    <section style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "80px 24px",
      position: "relative",
      overflow: "hidden",
      background: `radial-gradient(ellipse at 20% 50%, ${COLORS.darkRed}18 0%, transparent 60%), ${COLORS.black}`,
    }}>
      {/* Grain overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Top red line */}
        <div style={{
          width: loaded ? 120 : 0, height: 3, background: COLORS.red,
          transition: "width 1s ease 0.3s", marginBottom: 40,
        }} />
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(56px, 10vw, 96px)",
          fontWeight: 900,
          color: COLORS.white,
          letterSpacing: "0.06em",
          lineHeight: 0.95,
          margin: 0,
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.8s ease 0.5s",
        }}>
          MOUSE
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(20px, 3.5vw, 32px)",
          color: COLORS.red,
          fontStyle: "italic",
          margin: "16px 0 0 4px",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.7s ease 0.8s",
        }}>
          50 Years on the Mat
        </p>
        <div style={{
          width: loaded ? 60 : 0, height: 1, background: COLORS.warmGray,
          transition: "width 0.8s ease 1.1s", margin: "32px 0",
        }} />
        <p style={{
          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
          fontSize: 17,
          color: COLORS.warmGray,
          lineHeight: 1.6,
          maxWidth: 540,
          margin: 0,
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.7s ease 1.2s",
        }}>
          A feature-length documentary honoring Coach Dave &ldquo;Mouse&rdquo; McCollum
          — the winningest wrestling coach in District 3 history.
        </p>
        <div style={{
          display: "flex", gap: 16, marginTop: 40, flexWrap: "wrap",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.7s ease 1.5s",
        }}>
          <a href="#story" style={{
            fontFamily: "'Source Sans 3', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: COLORS.white,
            background: COLORS.red,
            padding: "14px 32px",
            textDecoration: "none",
            transition: "background 0.3s",
          }}
            onMouseEnter={e => (e.target as HTMLAnchorElement).style.background = COLORS.darkRed}
            onMouseLeave={e => (e.target as HTMLAnchorElement).style.background = COLORS.red}
          >
            SHARE YOUR STORY
          </a>
          <a href="#sponsor" style={{
            fontFamily: "'Source Sans 3', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: COLORS.warmGray,
            border: `1px solid ${COLORS.warmGray}40`,
            padding: "14px 32px",
            textDecoration: "none",
            transition: "all 0.3s",
          }}
            onMouseEnter={e => { (e.target as HTMLAnchorElement).style.borderColor = COLORS.red; (e.target as HTMLAnchorElement).style.color = COLORS.white; }}
            onMouseLeave={e => { (e.target as HTMLAnchorElement).style.borderColor = `${COLORS.warmGray}40`; (e.target as HTMLAnchorElement).style.color = COLORS.warmGray; }}
          >
            SUPPORT THIS FILM
          </a>
        </div>
      </div>
      {/* Scroll indicator */}
      <div style={{
        position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        opacity: loaded ? 0.4 : 0, transition: "opacity 1s ease 2s",
      }}>
        <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, letterSpacing: "0.15em", color: COLORS.warmGray }}>SCROLL</span>
        <div style={{ width: 1, height: 32, background: `linear-gradient(${COLORS.warmGray}, transparent)` }} />
      </div>
    </section>
  );
}

// ─── ABOUT ───
function About() {
  return (
    <section style={{ background: COLORS.offWhite, padding: "100px 24px", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 4, height: "100%", background: COLORS.red }} />
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <FadeIn>
          <p style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.2em", color: COLORS.red, marginBottom: 16,
          }}>THE STORY</p>
          <RedBar />
        </FadeIn>
        <FadeIn delay={0.15}>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 800, color: COLORS.black, lineHeight: 1.2, margin: "28px 0 24px",
          }}>
            One man. One mat. Five decades.
          </h2>
        </FadeIn>
        <FadeIn delay={0.25}>
          <p style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 17, color: "#374151",
            lineHeight: 1.75, marginBottom: 20,
          }}>
            For nearly half a century, Dave &ldquo;Mouse&rdquo; McCollum has stood at the edge of the mat at
            Bermudian Springs High School in York Springs, Pennsylvania. With more than 600 career
            victories, he&apos;s the winningest coach in District 3 history and one of only four coaches
            in all of Pennsylvania to reach that milestone.
          </p>
        </FadeIn>
        <FadeIn delay={0.35}>
          <p style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 17, color: "#374151",
            lineHeight: 1.75, marginBottom: 20,
          }}>
            But this film isn&apos;t about wins and losses. It&apos;s about what happens when one person
            commits their entire life to shaping young men — as a teacher in the classroom and a
            coach on the mat — and what those young men carry with them long after they leave.
          </p>
        </FadeIn>
        <FadeIn delay={0.45}>
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: COLORS.red,
            fontStyle: "italic", lineHeight: 1.6, marginTop: 32,
            borderLeft: `3px solid ${COLORS.red}`, paddingLeft: 20,
          }}>
            A documentary about legacy, mentorship, and the quiet power of showing up —
            every single day — for 50 years.
          </p>
        </FadeIn>
        {/* Stats */}
        <FadeIn delay={0.5}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 24, marginTop: 48,
          }}>
            {[
              { num: "600+", label: "Career Victories" },
              { num: "50", label: "Years Coaching" },
              { num: "#1", label: "District 3 All-Time" },
              { num: "1000s", label: "Lives Shaped" },
            ].map((s, i) => (
              <div key={i} style={{
                background: COLORS.white, padding: "24px 20px",
                borderLeft: `3px solid ${COLORS.red}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36,
                  fontWeight: 900, color: COLORS.red, lineHeight: 1,
                }}>{s.num}</div>
                <div style={{
                  fontFamily: "'Source Sans 3', sans-serif", fontSize: 13,
                  color: "#6B7280", marginTop: 6, fontWeight: 600,
                }}>{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── SUPPORT ───
function Sponsorship() {
  return (
    <section id="sponsor" style={{ background: COLORS.offWhite, padding: "100px 24px", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 4, height: "100%", background: COLORS.red }} />
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <FadeIn>
          <p style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.2em", color: COLORS.red, marginBottom: 16,
          }}>SUPPORT THIS FILM</p>
          <RedBar />
        </FadeIn>
        <FadeIn delay={0.15}>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(26px, 4vw, 38px)",
            fontWeight: 800, color: COLORS.black, lineHeight: 1.2,
            margin: "28px 0 16px",
          }}>
            Help us tell this story the way it deserves to be told.
          </h2>
          <p style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 16, color: "#4B5563",
            lineHeight: 1.7, marginBottom: 20,
          }}>
            This documentary is funded entirely by community sponsorships — local businesses
            and individuals who believe Coach McCollum&apos;s legacy is worth preserving at the
            highest level. Every contribution goes directly to production: crew, equipment,
            post-production, and the community premiere event.
          </p>
          <p style={{
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 16, color: "#4B5563",
            lineHeight: 1.7, marginBottom: 40,
          }}>
            We have sponsorship opportunities at multiple levels, from presenting
            sponsors with prominent title card credits to community supporters listed in
            the credits alongside everyone who made this possible.
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <div style={{
            background: COLORS.black, padding: "40px 36px",
            borderLeft: `4px solid ${COLORS.red}`,
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            <p style={{
              fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22,
              color: COLORS.white, margin: 0, fontWeight: 700, lineHeight: 1.3,
            }}>
              Interested in being part of this story?
            </p>
            <p style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 15,
              color: COLORS.warmGray, margin: 0, lineHeight: 1.7,
            }}>
              Reach out and we&apos;ll send you the full project brief with sponsorship
              details, production timeline, and premiere plans.
            </p>
            <a href="mailto:chris@aumenfilm.co" style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.08em", color: COLORS.white,
              background: COLORS.red, padding: "16px 36px",
              textDecoration: "none", alignSelf: "flex-start",
              transition: "background 0.3s",
            }}
              onMouseEnter={e => (e.target as HTMLAnchorElement).style.background = COLORS.darkRed}
              onMouseLeave={e => (e.target as HTMLAnchorElement).style.background = COLORS.red}
            >
              GET IN TOUCH
            </a>
            <p style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13,
              color: COLORS.warmGray, margin: 0,
            }}>
              Chris Aumen • Aumen Film Co. •{" "}
              <span style={{ color: COLORS.red }}>chris@aumenfilm.co</span>
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── FOOTER ───
function Footer() {
  return (
    <footer style={{
      background: COLORS.black, padding: "60px 24px 40px",
      borderTop: `3px solid ${COLORS.red}`,
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18,
          color: COLORS.white, fontWeight: 700, margin: "0 0 4px",
        }}>MOUSE</p>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14,
          color: COLORS.red, fontStyle: "italic", margin: "0 0 24px",
        }}>50 Years on the Mat</p>
        <div style={{ width: 40, height: 1, background: COLORS.warmGray + "40", margin: "0 auto 24px" }} />
        <p style={{
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 13,
          color: COLORS.warmGray, margin: "0 0 6px",
        }}>
          Produced by Aumen Film Co. • York Springs, PA
        </p>
        <p style={{
          fontFamily: "'Source Sans 3', sans-serif", fontSize: 12,
          color: COLORS.warmGray + "80", margin: 0,
        }}>
          © 2026 Aumen Film Co. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ─── MAIN ───
export default function MouseLandingPage() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;0,900;1,400;1,700&family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet" />
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
      <div style={{ minHeight: "100vh" }}>
        <Hero />
        <About />
        <ShareStory />
        <Sponsorship />
        <Footer />
      </div>
    </>
  );
}
