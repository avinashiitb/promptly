import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import TopBar from './components/TopBar';
import Scratchpad from './components/Scratchpad';
import TerminalView from './components/TerminalView';

function App() {
  const genId = () => Math.random().toString(36).substr(2, 9);

  const [isReady,       setIsReady]       = useState(false);
  const [fileName,      setFileName]      = useState('Promptly');
  const [breadcrumbs,   setBreadcrumbs]   = useState([]);
  // editorData is the INITIAL content passed to BlockNote on first mount.
  // After mount, current blocks are tracked via editorDataRef (no re-renders).
  const [editorData,    setEditorData]    = useState(null);
  const editorDataRef = useRef(null);  // always up-to-date, no re-render cost
  const [leftPaneWidth, setLeftPaneWidth] = useState(50);
  const [theme,         setTheme]         = useState('light-theme');
  const isDragging = useRef(false);

  const [contentDoc,   setContentDoc]   = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [fileId] = useState(() => {
    let id = window.pluginAPI?.context?.fileId;
    if (id) return id;
    try {
      const url = new URL(window.location.href);
      id = url.searchParams.get('fileId');
      if (!id && window.location.hash.includes('?')) {
        id = new URLSearchParams(window.location.hash.split('?')[1]).get('fileId');
      }
    } catch {}
    return id || `term-${genId()}`;
  });
  const [sessionId] = useState(() => `sess-${genId()}`);

  // ── Pane resizer ──────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const w = (e.clientX / window.innerWidth) * 100;
    if (w >= 20 && w <= 80) setLeftPaneWidth(w);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.cursor = 'default';
      window.dispatchEvent(new Event('resize'));
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup',  handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',  handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Legacy → BlockNote migration ────────────────────────────
  // Old format: { commands: [{id, title, text}], leftPaneWidth }
  // New format: Block[] where each command becomes H3 heading + terminal block
  const migrateFromLegacy = useCallback((commands) => {
    const blocks = [];
    commands.forEach(({ title, text }) => {
      const heading = title?.trim();
      const code    = text?.trim();
      if (heading) {
        blocks.push({
          type: 'heading',
          props: { level: 3 },
          content: [{ type: 'text', text: heading, styles: {} }],
        });
      }
      if (code) {
        blocks.push({ type: 'terminal', props: { code } });
      }
    });
    return blocks.length > 0 ? blocks : undefined;
  }, []);

  useEffect(() => {
    const load = async () => {
      console.log('[Promptly:load] Starting load. fileId:', fileId, '| pluginAPI:', !!window.pluginAPI);
      if (window.pluginAPI && fileId) {
        try {
          const fileInfo = await window.pluginAPI.getFileDetailsById(fileId);
          if (fileInfo?.title) setFileName(fileInfo.title);

          // Fetch breadcrumb path
          if (window.pluginAPI.getNestedPath && fileId !== `term-${fileId.split('-')[1]}`) {
            window.pluginAPI.getNestedPath({ fileId }).then((result) => {
              if (result) {
                const segs = [
                  ...result.folders.map((f) => ({ label: f.name, isFile: false })),
                  ...(result.file ? [{ label: result.file.title, isFile: true }] : []),
                ];
                setBreadcrumbs(segs);
              }
            }).catch(() => {});
          }

          const docs = await window.pluginAPI.getDocumentsByParentFile(fileId);
          console.log('[Promptly:load] docs returned:', docs?.length, 'doc(s)');

          if (docs?.length > 0) {
            const doc = docs[0];
            setContentDoc(doc);
            console.log('[Promptly:load] raw doc.blocks[0]:', JSON.stringify(doc?.blocks?.[0]));

            let saved = doc?.blocks?.[0]?.data;
            if (typeof saved === 'string') {
              try { saved = JSON.parse(saved); } catch {}
            }
            console.log('[Promptly:load] parsed saved:', saved);

            if (saved && typeof saved === 'object') {
              if (Array.isArray(saved.editorBlocks)) {
                console.log('[Promptly:load] ✅ New format — editorBlocks count:', saved.editorBlocks.length);
                editorDataRef.current = saved.editorBlocks; // ← sync ref immediately so auto-save doesn't write null
                setEditorData(saved.editorBlocks);
              } else if (Array.isArray(saved.commands) && saved.commands.length > 0) {
                console.log('[Promptly:load] 🔄 Legacy format — migrating', saved.commands.length, 'commands');
                const migrated = migrateFromLegacy(saved.commands);
                if (migrated) {
                  editorDataRef.current = migrated; // ← sync ref before auto-save fires
                  setEditorData(migrated);
                  setTimeout(() => handleSave(migrated), 500);
                }
              } else {
                console.log('[Promptly:load] ⚠️ No editorBlocks or commands found in saved data');
              }
              if (saved.leftPaneWidth) setLeftPaneWidth(saved.leftPaneWidth);
              if (saved.theme)         setTheme(saved.theme);
            } else {
              console.log('[Promptly:load] ⚠️ saved is null/not an object:', typeof saved);
            }
          } else {
            console.log('[Promptly:load] No docs found for this fileId — starting fresh');
          }
        } catch (err) {
          console.warn('[Promptly:load] ❌ Load error:', err);
        }
      } else {
        console.log('[Promptly:load] No pluginAPI or fileId — running standalone');
      }
      console.log('[Promptly:load] Done — setting isDataLoaded = true');
      setIsDataLoaded(true);
    };
    setTimeout(load, 100);
  }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = useCallback(async (latestBlocks) => {
    const blocksToSave = latestBlocks ?? editorDataRef.current;
    console.log('[Promptly:save] Called. isDataLoaded:', isDataLoaded,
      '| pluginAPI.updateDocument:', !!window.pluginAPI?.updateDocument,
      '| fileId:', fileId,
      '| blocks count:', Array.isArray(blocksToSave) ? blocksToSave.length : 'not array',
      '| contentDoc._id:', contentDoc?._id);

    if (!window.pluginAPI?.updateDocument || !fileId || !isDataLoaded) {
      console.warn('[Promptly:save] ⛔ Skipping save — guard failed');
      return;
    }
    const payload = {
      editorBlocks: blocksToSave,
      leftPaneWidth,
      theme,
    };
    console.log('[Promptly:save] Saving payload:', JSON.stringify(payload).slice(0, 200));
    try {
      const result = await window.pluginAPI.updateDocument(fileId, [{
        version: '1.0.0',
        time: Date.now(),
        blocks: [{ type: 'promptly', data: payload }],
        parent_file: fileId,
        _id: contentDoc?._id,
      }]);
      console.log('[Promptly:save] ✅ Save result:', result);
    } catch (err) { console.error('[Promptly:save] ❌ Save error:', err); }
  }, [leftPaneWidth, theme, fileId, contentDoc, isDataLoaded]);

  // Called by Scratchpad whenever blocks change — update ref + persist
  const handleEditorSave = useCallback((blocks) => {
    console.log('[Promptly:editorChange] Block count:', blocks?.length);
    editorDataRef.current = blocks;
    handleSave(blocks);
  }, [handleSave]);

  // Cmd+S manual save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleSave]);

  // Auto-save on layout/theme change
  const isInitial = useRef(true);
  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return; }
    if (!isDataLoaded) return;
    const t = setTimeout(() => handleSave(), 1000);
    return () => clearTimeout(t);
  }, [leftPaneWidth, theme, handleSave, isDataLoaded]);

  // ── Export ────────────────────────────────────────────────────
  const handleExportDS = () => {
    try {
      const blob = new Blob([JSON.stringify({
        _id: contentDoc?._id || `promptly-${Date.now()}`,
        parent_file: fileId,
        blocks: [{ type: 'promptly', data: { editorBlocks: editorData, leftPaneWidth } }],
        fileType: 'promptly',
      }, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `${(fileName || 'export').split('.')[0]}.ds`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.pluginAPI?.notify?.('Exported', 'success');
    } catch { window.pluginAPI?.notify?.('Export failed', 'error'); }
  };

  return (
    <div className={`App ${theme}`}>
      <TopBar
        breadcrumbs={breadcrumbs}
        fileName={fileName}
        isReady={isReady}
        onExportDS={handleExportDS}
        theme={theme}
        setTheme={setTheme}
      />

      <div className="workspace">
        {/* Only mount Scratchpad after data is loaded so useCreateBlockNote
            receives the correct initialContent on its very first call */}
        {isDataLoaded && (
          <Scratchpad
            editorData={editorData}
            onSave={handleEditorSave}
            sessionId={sessionId}
            leftPaneWidth={leftPaneWidth}
            theme={theme}
          />
        )}

        <div
          className="pane-resizer"
          onMouseDown={(e) => {
            e.preventDefault();
            isDragging.current = true;
            document.body.style.cursor = 'col-resize';
          }}
        />

        <div className="right-pane" style={{ width: `${100 - leftPaneWidth}%`, flex: 'none' }}>
          <TerminalView sessionId={sessionId} setIsReady={setIsReady} theme={theme} />
        </div>
      </div>
    </div>
  );
}

export default App;
