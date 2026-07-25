import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export function GlassNav({ alwaysGlass = false }: { alwaysGlass?: boolean }) {
  const [scrolled, setScrolled] = useState(alwaysGlass);

  useEffect(() => {
    if (alwaysGlass) return;
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [alwaysGlass]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6"
      style={{ paddingTop: scrolled ? 8 : 16, transition: "padding 0.35s cubic-bezier(0.83, 0, 0.17, 1)" }}
    >
      <div
        className="max-w-6xl mx-auto flex items-center justify-between px-6"
        style={{
          height: scrolled ? 56 : 64,
          borderRadius: "9999px",
          background: scrolled ? "rgba(23, 30, 25, 0.7)" : "transparent",
          backdropFilter: scrolled ? "blur(16px) saturate(1.8)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px) saturate(1.8)" : "none",
          boxShadow: scrolled
            ? "rgba(255, 225, 124, 0.08) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.25) 0px 4px 24px"
            : "none",
          border: scrolled ? "1px solid rgba(255, 225, 124, 0.12)" : "1px solid transparent",
          transition: "all 0.35s cubic-bezier(0.83, 0, 0.17, 1)",
        }}
      >
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center border-2 border-black">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#000" stroke="#000" strokeWidth="1" />
              <path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#ffe17c" />
            </svg>
          </div>
          <span className="font-heading font-bold text-lg text-white tracking-tight">Nox-Safe</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/docs"
            className="hidden md:block px-4 py-2 rounded-full font-body font-bold text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Docs
          </Link>
          <Link
            to="/connect"
            className="font-heading font-bold text-sm px-5 py-2.5 bg-primary text-black rounded-full border-2 border-black transition-all duration-200 hover:bg-primary/90"
            style={{ boxShadow: "3px 3px 0px 0px #000" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(3px, 3px)";
              e.currentTarget.style.boxShadow = "0 0 0 0 #000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0, 0)";
              e.currentTarget.style.boxShadow = "3px 3px 0px 0px #000";
            }}
          >
            Launch App
          </Link>
        </div>
      </div>
    </nav>
  );
}
