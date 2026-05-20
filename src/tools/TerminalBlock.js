import React, { useRef, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';

const MAX_HEIGHT = 800; // px

const TerminalBlockRender = ({ block, editor }) => {
  const textareaRef = useRef(null);
  const [running, setRunning] = useState(false);

  /* ── run handler ── */
  const run = () => {
    const code  = textareaRef.current?.value?.trim();
    if (!code) return;

    const sid   = window.__terminalSessionId;
    const write = window.__terminalWrite;
    if (!write || !sid) {
      console.warn('[TerminalBlock] terminal bridge not ready');
      return;
    }

    setRunning(true);
    code.split('\n').filter(Boolean).forEach((line, i, arr) => {
      setTimeout(() => {
        write(sid, line + '\r');
        if (i === arr.length - 1) setTimeout(() => setRunning(false), 400);
      }, i * 80);
    });
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
    e.stopPropagation();
  };

  const onChange = (e) => {
    editor.updateBlock(block, { props: { code: e.target.value } });
  };

  return (
    <div className="tn-block" contentEditable={false}>
      {/* ── Header ── */}
      <div className="tn-header">
        <div className="tn-dots">
          <span className="tn-dot tn-dot-red" />
          <span className="tn-dot tn-dot-yellow" />
          <span className="tn-dot tn-dot-green" />
          <span className="tn-label">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none"
                 stroke="currentColor" strokeWidth="2"
                 style={{ marginRight: 5, opacity: 0.6 }}>
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            bash
          </span>
        </div>
        <button
          className={`tn-run-btn${running ? ' tn-run-btn--running' : ''}`}
          onClick={run}
          title="Run in terminal (⌘+Enter)"
        >
          {running ? (
            <span className="tn-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      {/* ── Code textarea ── */}
      <div className="tn-editor-row">
        <textarea
          ref={textareaRef}
          className="tn-textarea"
          defaultValue={block.props.code}
          placeholder={"# bash command…  (⌘+Enter to run)"}
          rows={2}
          spellCheck={false}
          onKeyDown={onKeyDown}
          onChange={onChange}
          style={{ maxHeight: MAX_HEIGHT }}
        />
      </div>
    </div>
  );
};

export const createTerminalBlock = createReactBlockSpec(
  {
    type: 'terminal',
    propSchema: {
      code: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => <TerminalBlockRender {...props} />,
  }
);
