import React, { useEffect, useState, useMemo, useRef } from 'react';
import '../App.css';

function PromptlyPreview() {
  const [groups, setGroups] = useState([]);
  const [theme, setTheme] = useState('light-theme');
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const containerRef = useRef(null);

  // Parse parameters from hash or search
  const params = useMemo(() => {
    try {
      const hash = window.location.hash.split("?")[1] || "";
      const search = window.location.search.replace("?", "");
      const combined = new URLSearchParams(hash ? `${hash}&${search}` : search);
      return {
        fileId: combined.get("fileId") || "default",
        theme: combined.get("theme") || "light",
      };
    } catch {
      return { fileId: "default", theme: "light" };
    }
  }, []);

  // Sync theme
  useEffect(() => {
    const isDark = params.theme === 'dark';
    setTheme(isDark ? 'dark-theme' : 'light-theme');
    document.documentElement.className = isDark ? 'dark-theme' : 'light-theme';
  }, [params.theme]);

  // Load data
  useEffect(() => {
    const hasDbAccess = !!(window.pluginAPI?.getDocumentsByParentFile);

    const handleMessage = (e) => {
      if (!e.data) return;
      if (e.data.type === 'LOAD_PREVIEW') {
        const payload = e.data.data;
        if (payload) {
          if (Array.isArray(payload.groups)) {
            setGroups(payload.groups);
          }
          if (payload.theme) {
            setTheme(payload.theme);
          }
        }
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    // Let parent know we are ready
    window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');

    // Fallback load if we have direct DB access
    if (hasDbAccess) {
      window.pluginAPI.getDocumentsByParentFile(params.fileId)
        .then((docs) => {
          if (docs && docs.length > 0) {
            let saved = docs[0]?.blocks?.[0]?.data;
            if (typeof saved === 'string') {
              try { saved = JSON.parse(saved); } catch { }
            }
            if (saved && typeof saved === 'object') {
              if (Array.isArray(saved.groups)) {
                setGroups(saved.groups);
              }
              if (saved.theme) {
                setTheme(saved.theme);
              }
            }
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('[PromptlyPreview] Failed to load data directly:', err);
          setIsLoading(false);
        });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [params.fileId]);

  // Auto resize iframe height
  useEffect(() => {
    if (isLoading) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const height = entry.target.scrollHeight;
        window.parent.postMessage({ type: 'RESIZE_PREVIEW', height: Math.max(150, height + 24) }, '*');
      }
    });

    const el = containerRef.current;
    if (el) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [isLoading, groups]);

  // Forward wheel scroll events to parent in preview mode only when scroll boundaries are hit
  useEffect(() => {
    const handleWheel = (e) => {
      let target = e.target;
      let scrollableAncestor = null;
      while (target && target !== document.body) {
        const overflowY = window.getComputedStyle(target).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight) {
          scrollableAncestor = target;
          break;
        }
        target = target.parentElement;
      }

      if (scrollableAncestor) {
        const scrollTop = scrollableAncestor.scrollTop;
        const scrollHeight = scrollableAncestor.scrollHeight;
        const clientHeight = scrollableAncestor.clientHeight;
        const delta = e.deltaY;

        const isAtTop = scrollTop <= 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        if (delta > 0 && !isAtBottom) {
          return; // Scrolling down, let it scroll internally
        }
        if (delta < 0 && !isAtTop) {
          return; // Scrolling up, let it scroll internally
        }
      }

      window.parent.postMessage({ type: 'IFRAME_WHEEL', deltaY: e.deltaY }, '*');
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const handleCopy = (itemId, cmdText) => {
    navigator.clipboard.writeText(cmdText);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--fg-muted)', fontSize: '13px', gap: '8px', fontFamily: 'var(--ui)' }}>
        <div className="spin" style={{ width: '16px', height: '16px' }} />
        <span>Loading Runbook Preview...</span>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--fg-muted)', fontSize: '13px', fontFamily: 'var(--ui)' }}>
        <span>No steps configured.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`App ${theme}`} style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: 'auto', padding: '16px 20px', fontFamily: 'var(--ui)', overflowY: 'auto' }}>
      {groups.map((group) => (
        <div key={group.id} style={{ marginBottom: '24px' }}>
          {/* Group Header */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px', marginBottom: '12px' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-.01em' }}>
              {group.title || 'Untitled Section'}
            </span>
          </div>

          {/* Group Items */}
          <div style={{ paddingLeft: '4px' }}>
            {group.items && group.items.map((item) => (
              <div key={item.id} style={{ marginBottom: '16px' }}>
                {item.type === 'text' ? (
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.6', color: 'var(--fg-muted)' }}>
                    {item.text}
                  </p>
                ) : (
                  <div style={{ border: '1px solid var(--border-soft)', borderRadius: '8px', overflow: 'hidden', background: 'var(--raised)', boxShadow: 'var(--shadow)' }}>
                    {/* Step Title Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-soft)', background: 'var(--subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 17 10 11 4 5" />
                          <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <span style={{ fontSize: '13px', fontWeight: 650, color: 'var(--fg)', letterSpacing: '-.01em' }}>{item.title || 'Step'}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(item.id, item.cmd)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: copiedId === item.id ? 'var(--green)' : 'var(--fg-muted)', transition: 'color 0.15s ease' }}
                        title="Copy command"
                      >
                        {copiedId === item.id ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    {/* Command Code */}
                    <div style={{ position: 'relative', background: 'var(--inset)' }}>
                      <pre style={{
                        margin: 0,
                        padding: '10px 14px 10px 32px',
                        fontFamily: 'var(--mono)',
                        fontSize: '12.5px',
                        lineHeight: '1.6',
                        color: 'var(--fg)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        <span style={{ position: 'absolute', left: '12px', color: 'var(--green)', userSelect: 'none' }}>❯</span>
                        {item.cmd}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default PromptlyPreview;
