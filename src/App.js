import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import TopBar from './components/TopBar';
import Scratchpad from './components/Scratchpad';
import TerminalView from './components/TerminalView';

const SEED = [
  {
    id: "s1", title: "Configure Kubernetes Context",
    cmd: "aws eks update-kubeconfig \\\n  --region ap-south-1 \\\n  --name quickcart-prod-cluster",
    dur: "0.9s", status: "ok",
    summary: ["Context set to ", "quickcart-prod-cluster"],
  },
  {
    id: "s2", title: "Check Running Pods",
    cmd: "kubectl get pods -n production",
    dur: "0.6s", status: "warn",
    summary: ["", "1 of 5 pods failing — order-service"],
  },
  {
    id: "s3", title: "Tail Order-Service Logs",
    cmd: "kubectl logs deployment/order-service -f --tail=40",
    dur: "live", status: "warn",
    summary: ["", "OutOfMemoryError — JVM heap exhausted"],
  },
  {
    id: "s4", title: "Check Recent Cluster Events",
    cmd: "kubectl get events -n production \\\n  --sort-by=.metadata.creationTimestamp",
    dur: "0.5s", status: "warn",
    summary: ["", "OOMKilling + BackOff on order-service"],
  },
  {
    id: "s5", title: "Describe the Failing Pod",
    cmd: "kubectl describe pod order-service-7f9d5b6c4-qm8zt \\\n  -n production",
    dur: "0.7s", status: "error",
    summary: ["Root cause: ", "OOMKilled (exit 137) — memory limit 512Mi too low"],
  },
  {
    id: "s6", title: "Restart Deployment",
    cmd: "kubectl rollout restart deployment/order-service \\\n  -n production",
    dur: "4.2s", status: "ok",
    summary: ["", "Rollout complete — order-service healthy"],
  },
];

const defaultGroups = [
  {
    id: "g1", title: "Connect & Inspect", collapsed: false, items: [
      { id: "intro", type: "text", text: "Runbook for diagnosing the order-service crash in production. Work top-to-bottom, run a whole section, or hit Run all — output streams into the terminal on the right." },
      { id: "s1", type: "cmd", title: "Configure Kubernetes Context", cmd: "aws eks update-kubeconfig \\\n  --region ap-south-1 \\\n  --name quickcart-prod-cluster" },
      { id: "s2", type: "cmd", title: "Check Running Pods", cmd: "kubectl get pods -n production" },
    ]
  },
  {
    id: "g2", title: "Diagnose the Crash", collapsed: false, items: [
      { id: "s3", type: "cmd", title: "Tail Order-Service Logs", cmd: "kubectl logs deployment/order-service -f --tail=40" },
      { id: "s4", type: "cmd", title: "Check Recent Cluster Events", cmd: "kubectl get events -n production \\\n  --sort-by=.metadata.creationTimestamp" },
      { id: "s5", type: "cmd", title: "Describe the Failing Pod", cmd: "kubectl describe pod order-service-7f9d5b6c4-qm8zt \\\n  -n production" }
    ]
  },
  {
    id: "g3", title: "Remediate", collapsed: false, items: [
      { id: "s6", type: "cmd", title: "Restart Deployment", cmd: "kubectl rollout restart deployment/order-service \\\n  -n production" }
    ]
  },
];

function App() {
  const genId = () => Math.random().toString(36).substr(2, 9);

  const [isReady, setIsReady] = useState(false);
  const [fileName, setFileName] = useState('Promptly');
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  const [groups, setGroups] = useState(defaultGroups);
  const groupsRef = useRef(defaultGroups);

  const [states, setStates] = useState({});
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("terminal");
  const [active, setActive] = useState(null);
  const [running, setRunning] = useState(false);

  const [leftPaneWidth, setLeftPaneWidth] = useState(48);
  const [theme, setTheme] = useState('light-theme');
  const isDragging = useRef(false);

  const [contentDoc, setContentDoc] = useState(null);
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
    } catch { }
    return id || `term-${genId()}`;
  });
  const [sessionId] = useState(() => `sess-${genId()}`);

  // ── Pane resizer ──
  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const w = (e.clientX / window.innerWidth) * 100;
    if (w >= 25 && w <= 75) setLeftPaneWidth(w);
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
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Data Migration Parsers ──
  const parseBlocksToGroups = useCallback((blocks) => {
    const extractText = (content) => {
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.map(c => (typeof c === 'string' ? c : c.text || '')).join('');
    };

    const flatBlocks = [];
    const recurse = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach(b => {
        flatBlocks.push(b);
        if (Array.isArray(b.children) && b.children.length > 0) {
          recurse(b.children);
        }
      });
    };
    recurse(blocks);

    const converted = [];
    let currentGroup = null;

    flatBlocks.forEach((b) => {
      if (b.type === 'heading') {
        const text = extractText(b.content) || 'Add Heading';
        currentGroup = {
          id: `g-${genId()}`,
          title: text,
          collapsed: false,
          items: []
        };
        converted.push(currentGroup);
      } else {
        if (!currentGroup) {
          currentGroup = {
            id: `g-${genId()}`,
            title: 'Untitled Heading',
            collapsed: false,
            items: []
          };
          converted.push(currentGroup);
        }

        if (b.type === 'terminal') {
          currentGroup.items.push({
            id: `s-${genId()}`,
            type: 'cmd',
            title: 'Bash Command',
            cmd: b.props?.code || ''
          });
        } else {
          const text = extractText(b.content);
          currentGroup.items.push({
            id: `n-${genId()}`,
            type: 'text',
            text: text
          });
        }
      }
    });

    return converted.length > 0 ? converted : defaultGroups;
  }, []);

  const parseLegacyToGroups = useCallback((commands) => {
    const gr = {
      id: `g-${genId()}`,
      title: 'Untitled Heading',
      collapsed: false,
      items: []
    };
    commands.forEach(({ title, text }) => {
      if (title || text) {
        gr.items.push({
          id: `s-${genId()}`,
          type: 'cmd',
          title: title || 'Step',
          cmd: text || ''
        });
      }
    });
    return [gr];
  }, []);

  // ── Save ──
  const handleSave = useCallback(async (latestGroups) => {
    const groupsToSave = latestGroups ?? groupsRef.current;
    if (!window.pluginAPI?.updateDocument || !fileId || !isDataLoaded) return;

    const payload = {
      groups: groupsToSave,
      leftPaneWidth,
      theme,
    };

    try {
      await window.pluginAPI.updateDocument(fileId, [{
        version: '1.0.0',
        time: Date.now(),
        blocks: [{ type: 'promptly', data: payload }],
        parent_file: fileId,
        _id: contentDoc?._id,
      }]);
    } catch (err) { console.error('[Promptly:save] Save error:', err); }
  }, [leftPaneWidth, theme, fileId, contentDoc, isDataLoaded]);

  // ── Load ──
  useEffect(() => {
    const load = async () => {
      console.log('[Promptly:load] Starting load. fileId:', fileId, '| pluginAPI:', !!window.pluginAPI);
      if (window.pluginAPI && fileId) {
        try {
          const fileInfo = await window.pluginAPI.getFileDetailsById(fileId);
          if (fileInfo?.title) setFileName(fileInfo.title);

          if (window.pluginAPI.getNestedPath && fileId !== `term-${fileId.split('-')[1]}`) {
            window.pluginAPI.getNestedPath({ fileId }).then((result) => {
              if (result) {
                const segs = [
                  ...result.folders.map((f) => ({ label: f.name, isFile: false })),
                  ...(result.file ? [{ label: result.file.title, isFile: true }] : []),
                ];
                setBreadcrumbs(segs);
              }
            }).catch(() => { });
          }

          const docs = await window.pluginAPI.getDocumentsByParentFile(fileId);
          if (docs?.length > 0) {
            const doc = docs[0];
            setContentDoc(doc);

            let saved = doc?.blocks?.[0]?.data;
            if (typeof saved === 'string') {
              try { saved = JSON.parse(saved); } catch { }
            }

            if (saved && typeof saved === 'object') {
              if (Array.isArray(saved.groups) && saved.groups.length > 0) {
                console.log('[Promptly:load] ✅ New format — groups count:', saved.groups.length);
                groupsRef.current = saved.groups;
                setGroups(saved.groups);
              } else if (Array.isArray(saved.editorBlocks) && saved.editorBlocks.length > 0) {
                console.log('[Promptly:load] 🔄 BlockNote format — migrating blocks count:', saved.editorBlocks.length);
                const migrated = parseBlocksToGroups(saved.editorBlocks);
                groupsRef.current = migrated;
                setGroups(migrated);
                setTimeout(() => handleSave(migrated), 500);
              } else if (Array.isArray(saved.commands) && saved.commands.length > 0) {
                console.log('[Promptly:load] 🔄 Legacy format — migrating commands:', saved.commands.length);
                const migrated = parseLegacyToGroups(saved.commands);
                groupsRef.current = migrated;
                setGroups(migrated);
                setTimeout(() => handleSave(migrated), 500);
              }
              if (saved.leftPaneWidth) setLeftPaneWidth(saved.leftPaneWidth);
              if (saved.theme) setTheme(saved.theme);
            }
          }
        } catch (err) {
          console.warn('[Promptly:load] ❌ Load error:', err);
        }
      }
      setIsDataLoaded(true);
    };
    setTimeout(load, 100);
  }, [fileId, parseBlocksToGroups, parseLegacyToGroups, handleSave]);

  // Sync state triggers auto-save
  const updateGroupsState = useCallback((newGroups) => {
    groupsRef.current = newGroups;
    setGroups(newGroups);
    handleSave(newGroups);
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

  // ── Command Runner ──
  const getSeed = (cmdText) => {
    if (!cmdText) return null;
    const normalized = cmdText.trim().replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ');
    return SEED.find(s => {
      const seedNorm = s.cmd.trim().replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ');
      return seedNorm.toLowerCase().includes(normalized.toLowerCase()) || normalized.toLowerCase().includes(seedNorm.toLowerCase());
    });
  };

  const runStep = useCallback(async (stepId) => {
    const flat = groupsRef.current.flatMap(g => g.items);
    const cur = flat.find(s => s.id === stepId);
    if (!cur || cur.type !== 'cmd') return;

    setActive(stepId);
    setStates(p => ({ ...p, [stepId]: { status: "running" } }));

    // Send command text to real shell terminal
    const sid = window.__terminalSessionId;
    const write = window.__terminalWrite;
    if (write && sid) {
      write(sid, cur.cmd + '\r');
    }

    // Determine status & details
    const seed = getSeed(cur.cmd);
    const histId = `h-${genId()}`;
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const finalStatus = seed ? seed.status : "ok";
    const finalDur = seed ? seed.dur : "0.5s";
    const finalSummary = seed ? seed.summary : ["", "Command executed"];

    setHistory(h => [...h, {
      id: histId,
      cmd: cur.cmd,
      title: cur.title,
      status: "running",
      dur: null,
      time: nowStr
    }]);

    // Simulated timing feedback
    const delay = seed ? (seed.dur === "live" ? 2200 : parseFloat(seed.dur) * 1000) : 800;
    await new Promise(r => setTimeout(r, delay));

    setStates(p => ({ ...p, [stepId]: { status: finalStatus, summary: finalSummary, dur: finalDur } }));
    setHistory(h => h.map(e => e.id === histId ? { ...e, status: finalStatus, dur: finalDur } : e));
  }, []);

  const handleRun = async (id) => {
    if (running) return;
    setRunning(true);
    await runStep(id);
    setRunning(false);
  };

  const handleRunAll = async () => {
    if (running) return;
    setRunning(true);
    setHistory([]);
    const cmds = groupsRef.current.flatMap(g => g.items).filter(it => it.type === 'cmd');
    for (const cmd of cmds) {
      await runStep(cmd.id);
      await new Promise(r => setTimeout(r, 400));
    }
    setRunning(false);
  };

  const handleRunGroup = async (gid) => {
    if (running) return;
    setRunning(true);
    const g = groupsRef.current.find(x => x.id === gid);
    if (g) {
      const cmds = g.items.filter(it => it.type === 'cmd');
      for (const cmd of cmds) {
        await runStep(cmd.id);
        await new Promise(r => setTimeout(r, 400));
      }
    }
    setRunning(false);
  };

  // Jump helper (flashes step card)
  const jump = (stepId) => {
    setTab('terminal');
    const el = document.getElementById(`step-${stepId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add("active");
      setTimeout(() => el.classList.remove("active"), 1400);
    }
  };

  // ── Runbook item mutations ──
  const updateItem = (id, fn) => {
    const updated = groupsRef.current.map(g => ({
      ...g,
      items: g.items.map(it => it.id === id ? fn(it) : it)
    }));
    updateGroupsState(updated);
  };

  const editStep = (id, cmd) => updateItem(id, it => ({ ...it, cmd }));
  const toggleCollapse = (id) => updateItem(id, it => ({ ...it, collapsed: !it.collapsed }));
  const editTitle = (id, title) => updateItem(id, it => ({ ...it, title }));
  const editText = (id, text) => updateItem(id, it => ({ ...it, text }));

  const delItem = (id) => {
    const updated = groupsRef.current.map(g => ({
      ...g,
      items: g.items.filter(i => i.id !== id)
    }));
    updateGroupsState(updated);
    setStates(p => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const addItem = (gid, kind) => {
    const id = `item-${genId()}`;
    const it = kind === "text"
      ? { id, type: "text", text: "" }
      : { id, type: "cmd", title: "New Step", cmd: "kubectl " };

    const updated = groupsRef.current.map(g =>
      g.id === gid ? { ...g, items: [...g.items, it] } : g
    );
    updateGroupsState(updated);
  };

  // ── Runbook group mutations ──
  const toggleGroup = (gid) => {
    const updated = groupsRef.current.map(g =>
      g.id === gid ? { ...g, collapsed: !g.collapsed } : g
    );
    updateGroupsState(updated);
  };

  const editGroupTitle = (gid, title) => {
    const updated = groupsRef.current.map(g =>
      g.id === gid ? { ...g, title } : g
    );
    updateGroupsState(updated);
  };

  const delGroup = (gid) => {
    const target = groupsRef.current.find(x => x.id === gid);
    const updated = groupsRef.current.filter(x => x.id !== gid);
    updateGroupsState(updated);
    setStates(p => {
      const n = { ...p };
      (target?.items || []).forEach(i => delete n[i.id]);
      return n;
    });
  };

  const addGroup = () => {
    const updated = [
      ...groupsRef.current,
      { id: `g-${genId()}`, title: "New Section", collapsed: false, items: [] }
    ];
    updateGroupsState(updated);
  };

  const stepHandlers = {
    run: handleRun,
    editStep,
    editTitle,
    editText,
    toggleCollapse,
    jump,
    del: delItem
  };

  // ── Export ──
  const handleExportDS = () => {
    try {
      const blob = new Blob([JSON.stringify({
        _id: contentDoc?._id || `promptly-${Date.now()}`,
        parent_file: fileId,
        blocks: [{ type: 'promptly', data: { groups, leftPaneWidth } }],
        fileType: 'promptly',
      }, null, 2)], { type: 'application/json' });

      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `${(fileName || 'export').split('.')[0]}.ds`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.pluginAPI?.notify?.('Exported successfully', 'success');
    } catch {
      window.pluginAPI?.notify?.('Export failed', 'error');
    }
  };

  return (
    <div className={`App ${theme}`} data-theme={theme === 'dark-theme' ? 'dark' : 'light'}>
      <TopBar
        breadcrumbs={breadcrumbs}
        fileName={fileName}
        isReady={isReady}
        onExportDS={handleExportDS}
        theme={theme}
        setTheme={setTheme}
        onRunAll={handleRunAll}
        running={running}
      />

      <div className="workspace">
        {isDataLoaded && (
          <Scratchpad
            groups={groups}
            states={states}
            active={active}
            running={running}
            fileName={fileName}
            leftPaneWidth={leftPaneWidth}
            theme={theme}
            stepHandlers={stepHandlers}
            onGroupsChange={updateGroupsState}
            addGroup={addGroup}
            delGroup={delGroup}
            toggleGroup={toggleGroup}
            editGroupTitle={editGroupTitle}
            runGroup={handleRunGroup}
            addItem={addItem}
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
          <TerminalView
            sessionId={sessionId}
            setIsReady={setIsReady}
            theme={theme}
            history={history}
            setHistory={setHistory}
            tab={tab}
            setTab={setTab}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
