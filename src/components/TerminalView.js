import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

function TerminalView({ sessionId, setIsReady, theme }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddon = useRef(null);

  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
    if (termInstance.current) {
      termInstance.current.options.theme = theme === 'light-theme' ? {
        background: '#ffffff',
        foreground: '#111827',
        cursor: '#111827',
        selectionBackground: '#e5e7eb',
      } : {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264F78',
      };
    }
  }, [theme]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize Xterm
    const term = new Terminal({
      cursorBlink: true,
      theme: themeRef.current === 'light-theme' ? {
        background: '#ffffff',
        foreground: '#111827',
        cursor: '#111827',
        selectionBackground: '#e5e7eb',
      } : {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264F78',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);

    term.open(terminalRef.current);
    
    // Fit must be delayed slightly on remount or it causes crash loops in xterm
    setTimeout(() => {
      try { fit.fit(); } catch (e) { console.warn("Fit error", e); }
    }, 50);

    termInstance.current = term;
    fitAddon.current = fit;

    const proxy = window.terminalAPI || window.pluginAPI?.terminal;
    let unsubscribeData;

    if (proxy) {
      console.log(`[Plugin Frontend] Setting up IPC proxy listener for ${sessionId}...`);
      let isFirstData = true;
      unsubscribeData = proxy.onData(sessionId, (data) => {
        console.log(`[Plugin Frontend] Received stdout (${data?.length || 0} bytes)`);
        if (data) {
          if (isFirstData) {
            term.write('\x1b[2K\x1b[G'); // Clear current line
            isFirstData = false;
          }
          term.write(data);
        }
      });

      term.onData((data) => {
        console.log(`[Plugin Frontend] User typed input`);
        proxy.input(sessionId, data);
      });

      term.onResize((size) => {
        proxy.resize(sessionId, size.cols, size.rows);
      });

      console.log(`[Plugin Frontend] Requesting terminal create/reconnect against main process for ${sessionId}...`);
      term.write('\x1b[3m\x1b[90mStarting terminal session...\x1b[0m');
      proxy.create(sessionId);
      
      setIsReady(true);
    } else {
      term.write('\r\n\x1b[31mError: Terminal IPC Bridge missing (terminalAPI or pluginAPI.terminal).\x1b[0m\r\n');
      term.write('\r\nEnsure you have added core-integration files to your Electron main process.\r\n');
    }

    // Auto-resize handler
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unsubscribeData) unsubscribeData();
      if (proxy) {
        proxy.dispose(sessionId);
      }
      term.dispose();
    };
  }, [sessionId, setIsReady]);

  return (
    <div className="terminal-container" ref={terminalRef}></div>
  );
}

export default TerminalView;
