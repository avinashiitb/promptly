import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

/* ── Inline SVGs for Terminal toolbar & History logs ── */
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
  chev:    <Ic d="m9 6 6 6-6 6" />,
  check:   <Ic d="m4.5 12.5 5 5 10-11" sw={2.6} />,
  warn:    <Ic d={["M12 4 2.5 20h19z", "M12 10v4", "M12 17.5v.5"]} sw={2.2} />,
  x:       <Ic d={["M6 6l12 12", "M18 6 6 18"]} sw={2.6} />,
  trash:   <Ic d={["M4 7h16", "M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2", "m6 7 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"]} />,
  eraser:  <Ic d={["M4 19h16", "m3.5 14.5 6-6 6 6-4 4h-4z", "m9.5 8.5 5-5 6 6-5 5"]} />,
  expand:  <Ic d={["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"]} />,
  history: <Ic d={["M12 3a9 9 0 1 1-8.49 12", "M12 8v4.2l3 1.8", "M3 4.5v4h4"]} />,
  search:  <Ic d={["M10.5 3a7.5 7.5 0 1 0 7.5 7.5 7.5 7.5 0 0 0-7.5-7.5Z", "m21 21-4.3-4.3"]} />,
  up:      <Ic d="m18 15-6-6-6 6" />,
  down:    <Ic d="m6 9 6 6 6-6" />,
  close:   <Ic d={["M18 6 6 18", "M6 6l12 12"]} />,
};

function TerminalView({ sessionId, setIsReady, theme, history = [], setHistory, tab, setTab }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddon = useRef(null);
  const themeRef = useRef(theme);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAddonInstance = useRef(null);
  const searchInputRef = useRef(null);

  // Global keydown helper to toggle search
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (tab === 'terminal') {
          e.preventDefault();
          setShowSearch(true);
          setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          }, 50);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [tab]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q && searchAddonInstance.current) {
      searchAddonInstance.current.findNext(q, { incremental: true });
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery && searchAddonInstance.current) {
        if (e.shiftKey) {
          searchAddonInstance.current.findPrevious(searchQuery);
        } else {
          searchAddonInstance.current.findNext(searchQuery);
        }
      }
    } else if (e.key === 'Escape') {
      handleCloseSearch();
    }
  };

  const handleSearchPrev = () => {
    if (searchQuery && searchAddonInstance.current) {
      searchAddonInstance.current.findPrevious(searchQuery);
    }
  };

  const handleSearchNext = () => {
    if (searchQuery && searchAddonInstance.current) {
      searchAddonInstance.current.findNext(searchQuery);
    }
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    termInstance.current?.focus();
  };

  const handleToggleSearch = () => {
    setShowSearch((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
      }
      return next;
    });
  };

  // Sync theme
  useEffect(() => {
    themeRef.current = theme;
    if (termInstance.current) {
      termInstance.current.options.theme = theme === 'light-theme' ? {
        background: '#f6f8fa',
        foreground: '#1f2328',
        cursor: '#1f2328',
        selectionBackground: '#e5e7eb',
      } : {
        background: '#0b0f14',
        foreground: '#cdd9e5',
        cursor: '#ffffff',
        selectionBackground: '#264F78',
      };
    }
  }, [theme]);

  // Setup Xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: themeRef.current === 'light-theme' ? {
        background: '#f6f8fa',
        foreground: '#1f2328',
        cursor: '#1f2328',
        selectionBackground: '#e5e7eb',
      } : {
        background: '#0b0f14',
        foreground: '#cdd9e5',
        cursor: '#ffffff',
        selectionBackground: '#264F78',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);
    term.loadAddon(searchAddon);
    term.open(terminalRef.current);

    setTimeout(() => {
      try { fit.fit(); } catch (e) { console.warn("Fit error", e); }
    }, 50);

    termInstance.current = term;
    fitAddon.current = fit;
    searchAddonInstance.current = searchAddon;

    const proxy = window.terminalAPI || window.pluginAPI?.terminal;
    let unsubscribeData;

    if (proxy) {
      console.log(`[Promptly:Terminal] Setting up IPC proxy listener for ${sessionId}...`);
      let isFirstData = true;
      unsubscribeData = proxy.onData(sessionId, (data) => {
        if (data) {
          if (isFirstData) {
            term.write('\x1b[2K\x1b[G'); // Clear current line
            isFirstData = false;
          }
          term.write(data);
        }
      });

      term.onData((data) => {
        proxy.input(sessionId, data);
      });

      term.onResize((size) => {
        proxy.resize(sessionId, size.cols, size.rows);
      });

      proxy.create(sessionId);

      // Global helpers for Command Runner
      window.__terminalWrite = (sid, text) => {
        if (sid === sessionId) proxy.input(sessionId, text);
      };
      window.__terminalSessionId = sessionId;

      setIsReady(true);
    } else {
      term.write('\r\n\x1b[31mError: Terminal IPC Bridge missing (terminalAPI or pluginAPI.terminal).\x1b[0m\r\n');
    }

    const handleResize = () => {
      if (fitAddon.current) {
        try { fitAddon.current.fit(); } catch {}
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unsubscribeData) unsubscribeData();
      if (proxy) proxy.dispose(sessionId);
      term.dispose();
    };
  }, [sessionId, setIsReady]);

  // Fit terminal when tab switches back to 'terminal'
  useEffect(() => {
    if (tab === 'terminal' && fitAddon.current) {
      setTimeout(() => {
        try { fitAddon.current.fit(); } catch {}
      }, 50);
    }
  }, [tab]);

  // Re-run command from history click
  const handleReRun = (cmd) => {
    const sid = window.__terminalSessionId;
    const write = window.__terminalWrite;
    if (write && sid) {
      setTab('terminal');
      write(sid, cmd + '\r');
    }
  };

  const statIcon = (s) => s === "running" ? <span className="spin" style={{ width: 11, height: 11 }} />
    : s === "ok" ? I.check : s === "warn" ? I.warn : s === "error" ? I.x : null;

  return (
    <>
      {/* ── Terminal Header ── */}
      <div className="term-head">
        <div className="term-tabs">
          <button className={`term-tab${tab === 'terminal' ? ' active' : ''}`} onClick={() => setTab('terminal')}>
            <span className="tdot" />Terminal
          </button>
          <button className={`term-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
            {I.history}History{history.length > 0 && <span className="ttab-count">{history.length}</span>}
          </button>
        </div>
        <span className="term-sub">shell · active</span>
        <span className="spacer" />
        {tab === 'terminal' ? (
          <>
            <button className={`term-act${showSearch ? ' active' : ''}`} title="Search log (⌘F)" onClick={handleToggleSearch}>
              {I.search}
            </button>
            <button className="term-act" title="Clear terminal" onClick={() => termInstance.current?.clear()}>
              {I.eraser}
            </button>
          </>
        ) : (
          <button className="term-act" title="Clear history" onClick={() => setHistory([])}>
            {I.trash}
          </button>
        )}
        <button className="term-act" title="Maximize">
          {I.expand}
        </button>
      </div>

      {/* ── Terminal Canvas (display: none when inactive to retain process state) ── */}
      <div
        className="terminal-container"
        ref={terminalRef}
        style={{ display: tab === 'terminal' ? 'block' : 'none' }}
      >
        {tab === 'terminal' && showSearch && (
          <div className="term-search-overlay" onClick={(e) => e.stopPropagation()}>
            <input
              ref={searchInputRef}
              type="text"
              className="term-search-input"
              placeholder="Find in logs..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
            <button className="term-search-btn" title="Previous match (Shift+Enter)" onClick={handleSearchPrev}>
              {I.up}
            </button>
            <button className="term-search-btn" title="Next match (Enter)" onClick={handleSearchNext}>
              {I.down}
            </button>
            <button className="term-search-btn close" title="Close search (Esc)" onClick={handleCloseSearch}>
              {I.close}
            </button>
          </div>
        )}
      </div>

      {/* ── History Panel ── */}
      {tab === 'history' && (
        <div className="hist">
          {history.length === 0 ? (
            <div className="hist-empty">
              {I.history}
              <p>No commands run yet. Every command you run from a step is logged here.</p>
            </div>
          ) : (
            <>
              <div className="hist-day">Today</div>
              {[...history].reverse().map((h, i) => (
                <div key={h.id || i} className="hrow" onClick={() => handleReRun(h.cmd)} title="Click to re-run in terminal">
                  <span className="hidx">{String(history.length - i).padStart(2, "0")}</span>
                  <span className={`hicon ${h.status}`}>{statIcon(h.status)}</span>
                  <span className="hmain">
                    <span className="hcmd">{h.cmd.replace(/\\\n\s*/g, " ")}</span>
                    <span className="hmeta">
                      {h.title && (
                        <>
                          <span className="htitle">{h.title}</span>
                          <span className="hsep">·</span>
                        </>
                      )}
                      <span className={`hstat ${h.status}`}>{h.status === 'running' ? 'running' : 'completed'}</span>
                      {h.dur && (
                        <>
                          <span className="hsep">·</span>
                          <span>{h.dur}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="htime">{h.time}</span>
                  <span className="hjump">{I.chev}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

export default TerminalView;
