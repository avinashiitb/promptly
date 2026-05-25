import React, { useState, useRef, useEffect } from 'react';

function TopBar({ breadcrumbs = [], fileName, isReady, onExportDS, theme, setTheme }) {
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

  // Build display segments: if breadcrumbs provided use them, else fallback to plain fileName
  const displaySegments = breadcrumbs.length > 0
    ? breadcrumbs
    : [{ label: fileName || 'Promptly', isFile: true }];

  return (
    <header className="terminal-topbar">
      <div className="topbar-left">
        <nav className="breadcrumb-path" aria-label="file path">
          <i className="fa-solid fa-folder" style={{ marginRight: 6, fontSize: 11, opacity: 0.8 }}></i>
          {displaySegments.map((seg, idx) => (
            <React.Fragment key={idx}>
              {!seg.isFile && (
                <>
                  <span className="breadcrumb-segment breadcrumb-folder" title={seg.label}>
                    {seg.label}
                  </span>
                  <span className="breadcrumb-sep">›</span>
                </>
              )}
              {seg.isFile && (
                <span className="breadcrumb-segment breadcrumb-file" title={seg.label}>
                  {seg.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>
      
      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button className="status-indicator" title="Connection Status">
          {isReady ? (
            <><span className="status-dot online"></span> Connected</>
          ) : (
            <><span className="status-dot offline"></span> Disconnected</>
          )}
        </button>

        <button 
          onClick={() => setTheme(theme === 'dark-theme' ? 'light-theme' : 'dark-theme')}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme === 'dark-theme' ? '#e5e7eb' : '#374151',
            cursor: 'pointer',
            padding: '6px',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '4px'
          }}
          title={theme === 'dark-theme' ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          <i className={theme === 'dark-theme' ? "ri-sun-line" : "ri-moon-line"}></i>
        </button>

        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 12px",
              backgroundColor: theme === 'light-theme' ? "#ffffff" : "#2d2d2d",
              border: `1px solid ${theme === 'light-theme' ? "#e5e7eb" : "#404040"}`,
              borderRadius: "6px",
              fontSize: "13px",
              color: theme === 'light-theme' ? "#374151" : "#e5e7eb",
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            <i className="ri-lock-line" style={{ marginRight: "6px", color: theme === 'light-theme' ? "#6b7280" : "#9ca3af" }}></i>
            Options
            <i className="ri-arrow-down-s-line" style={{ marginLeft: "4px", color: theme === 'light-theme' ? "#6b7280" : "#9ca3af" }}></i>
          </button>

          {isMenuOpen && (
            <div style={{
              position: "absolute",
              right: 0,
              marginTop: "6px",
              width: "192px",
              backgroundColor: theme === 'light-theme' ? "#ffffff" : "#2d2d2d",
              borderRadius: "8px",
              boxShadow: theme === 'light-theme' ? "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" : "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
              border: `1px solid ${theme === 'light-theme' ? "#e5e7eb" : "#404040"}`,
              zIndex: 50
            }}>
              <div style={{ padding: "4px 0" }}>
                <div style={{ padding: "8px 16px", fontSize: "11px", fontWeight: 600, color: theme === 'light-theme' ? "#6b7280" : "#9CA3AF", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Export Options
                </div>
                <button
                  onClick={() => {
                    if (onExportDS) onExportDS();
                    setIsMenuOpen(false);
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", padding: "8px 16px", backgroundColor: "transparent", border: "none", fontSize: "13px", color: theme === 'light-theme' ? "#374151" : "#e5e7eb", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme === 'light-theme' ? '#f3f4f6' : '#404040'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <i className="ri-file-code-fill" style={{ marginRight: "10px", color: theme === 'light-theme' ? "#2563EB" : "#60A5FA" }}></i>
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
