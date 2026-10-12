import React, { useState, useRef, useEffect } from 'react';

/* ── Inline SVG Icons matching the EKS template ── */
const Ic = ({ d, fill, size = 16, sw = 2 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const I = {
  cube:    <Ic d={["m21 7.5-9-5-9 5v9l9 5 9-5z", "m3 7.5 9 5 9-5", "M12 12.5v9"]} />,
  chev:    <Ic d="m9 6 6 6-6 6" />,
  export:  <Ic d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"]} />,
  playAll: <Ic d={["M5 5.5v13l9-6.5z", "M19 5.5v13"]} />,
};

function TopBar({
  breadcrumbs = [],
  fileName,
  isReady,
  onExportDS,
  theme,
  setTheme,
  onRunAll,
  running,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displaySegments = breadcrumbs.length > 0
    ? breadcrumbs
    : [
        { label: "QuickCart Platform", isFile: false },
        { label: "AWS-EKS", isFile: false },
        { label: fileName || "aws-eks-debugging", isFile: true }
      ];

  return (
    <header className="terminal-topbar">
      <div className="topbar-left">
        <nav className="breadcrumb-path" aria-label="file path">
          <span style={{ display: 'grid', placeItems: 'center', marginRight: '8px', color: 'var(--fg-subtle)' }}>
            {I.cube}
          </span>
          {displaySegments.map((seg, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="breadcrumb-sep">{I.chev}</span>}
              <span className={`breadcrumb-segment ${seg.isFile ? 'breadcrumb-file' : 'breadcrumb-folder'}`} title={seg.label}>
                {seg.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="topbar-right">
        {/* Connected Indicator */}
        <span className="status-indicator" title="Connection Status">
          <span className={`status-dot ${isReady ? 'online' : 'offline'}`} />
          {isReady ? 'Connected' : 'Disconnected'}
        </span>

        {/* Run All Button */}
        <button className="btn btn-primary" disabled={running} onClick={onRunAll}>
          {running ? (
            <span className="spin" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,.4)", borderWidth: 2 }} />
          ) : (
            I.playAll
          )}
          {running ? "Running…" : "Run all"}
        </button>

        {/* Export Dropdown Menu */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            className="icon-btn"
            title="Export Options"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {I.export}
          </button>

          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                marginTop: "6px",
                width: "192px",
                backgroundColor: theme === 'light-theme' ? "#ffffff" : "#161b22",
                borderRadius: "8px",
                boxShadow: theme === 'light-theme'
                  ? "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
                  : "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
                border: `1px solid var(--border-soft)`,
                zIndex: 50,
              }}
            >
              <div style={{ padding: "4px 0" }}>
                <div
                  style={{
                    padding: "8px 16px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  Export Options
                </div>
                <button
                  onClick={() => {
                    if (onExportDS) onExportDS();
                    setIsMenuOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 16px",
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "13px",
                    color: "var(--fg)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'light-theme' ? '#f3f4f6' : '#21262d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ marginRight: "10px", color: theme === 'light-theme' ? "#2563EB" : "#58a6ff" }}>📄</span>
                  Devscribe (.ds)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
