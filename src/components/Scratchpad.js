import React, { useRef, useEffect } from 'react';

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
  chev:   <Ic d="m9 6 6 6-6 6" />,
  caret:  <Ic d="m6 9 6 6 6-6" />,
  play:   <Ic d="M7 5.5v13l11-6.5z" fill />,
  playAll:<Ic d={["M5 5.5v13l9-6.5z", "M19 5.5v13"]} />,
  rerun:  <Ic d={["M21 12a9 9 0 1 1-2.6-6.3", "M21 4v4h-4"]} />,
  check:  <Ic d="m4.5 12.5 5 5 10-11" sw={2.6} />,
  warn:   <Ic d={["M12 4 2.5 20h19z", "M12 10v4", "M12 17.5v.5"]} sw={2.2} />,
  x:      <Ic d={["M6 6l12 12", "M18 6 6 18"]} sw={2.6} />,
  plus:   <Ic d={["M12 5v14", "M5 12h14"]} />,
  trash:  <Ic d={["M4 7h16", "M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2", "m6 7 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"]} />,
  note:   <Ic d={["M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M8 8.5h8", "M8 12h8", "M8 15.5h5"]} />,
  grip: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="9" cy="5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="9" cy="19" r="2" />
      <circle cx="15" cy="5" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="15" cy="19" r="2" />
    </svg>
  ),
};

/* ════ STEP CARD ════════════════════════════════════════════════════ */
function StepCard({
  idx,
  step,
  state,
  active,
  collapsed,
  onToggle,
  onRun,
  onEdit,
  onTitle,
  onJump,
  onDelete,
  draggedItemId,
  dragOverItemId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const taRef = useRef(null);
  const [dragEnabled, setDragEnabled] = React.useState(false);

  const fit = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  useEffect(() => {
    fit(taRef.current);
  }, [step.cmd, collapsed]);

  const st = state.status || "idle"; // idle | running | ok | warn | error
  const ran = st && st !== "idle" && st !== "running";
  const badge = st === "running" ? <span className="spin" />
    : st === "ok" ? I.check : st === "warn" ? I.warn : st === "error" ? I.x : (idx + 1);

  const cmdPreview = step.cmd.replace(/\\\n\s*/g, " ").trim();

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
    e.stopPropagation();
  };

  const isDragging = step.id === draggedItemId;
  const isDragOver = step.id === dragOverItemId;

  return (
    <div
      className={`step${active ? " active" : ""}${st === "running" ? " running" : ""}${collapsed ? " collapsed" : ""}${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}`}
      id={`step-${step.id}`}
      draggable={dragEnabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.stopPropagation();
        onDragOver(e);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        onDragLeave();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e);
      }}
    >
      <div className="step-head">
        <div
          className="drag-handle"
          title="Drag to reorder"
          onMouseEnter={() => setDragEnabled(true)}
          onMouseLeave={() => setDragEnabled(false)}
        >
          {I.grip}
        </div>
        <button className="step-caret" title={collapsed ? "Expand step" : "Collapse step"} onClick={onToggle}>
          {I.caret}
        </button>
        <span className={`badge ${st}`}>{badge}</span>
        {collapsed ? (
          <>
            <span className="step-title-static" onClick={onToggle}>{step.title}</span>
            <span className="step-preview" onClick={onToggle} title={cmdPreview}>{cmdPreview}</span>
          </>
        ) : (
          <input
            className="step-title"
            value={step.title}
            onChange={(e) => onTitle(e.target.value)}
            spellCheck={false}
          />
        )}
        <button className="hover-del" title="Delete step" onClick={onDelete}>
          {I.trash}
        </button>
      </div>
      {!collapsed && (
        <div className="step-body">
          <div className="cmd-wrap">
            <textarea
              ref={taRef}
              className="cmd"
              value={step.cmd}
              spellCheck={false}
              onChange={(e) => {
                onEdit(e.target.value);
                fit(e.target);
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="# bash command… (⌘+Enter to run)"
            />
          </div>
          <div className="step-foot">
            <span className="tag">
              <span className="lang-dot" />
              bash
            </span>
            {ran ? (
              <span className={`result ${st}`}>
                <span className="rico">{st === "ok" ? I.check : st === "warn" ? I.warn : I.x}</span>
                <span className="rtext">
                  {(state.summary || ["", ""])[0]}
                  <b>{(state.summary || ["", ""])[1]}</b>
                </span>
                {state.dur && <span className="dur">· {state.dur}</span>}
                <span className="jump" onClick={() => onJump(step.id)}>
                  View output →
                </span>
              </span>
            ) : st === "running" ? (
              <span className="result" style={{ color: "var(--accent)" }}>
                <span className="rtext">Running…</span>
              </span>
            ) : null}
            <span className="foot-spacer" />
            <button className={`run-btn${ran ? " rerun" : ""}`} disabled={st === "running"} onClick={onRun}>
              {ran ? I.rerun : I.play}
              {ran ? "Re-run" : "Run"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ TEXT / NOTE BLOCK ════════════════════════════════════════════ */
function TextBlock({
  id,
  text,
  onEdit,
  onDelete,
  draggedItemId,
  dragOverItemId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const ref = useRef(null);
  const [dragEnabled, setDragEnabled] = React.useState(false);

  const fit = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  useEffect(() => {
    fit(ref.current);
  }, [text]);

  const isDragging = id === draggedItemId;
  const isDragOver = id === dragOverItemId;

  return (
    <div
      className={`note${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}`}
      draggable={dragEnabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.stopPropagation();
        onDragOver(e);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        onDragLeave();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e);
      }}
    >
      <div className="note-bar">
        <div
          className="drag-handle"
          title="Drag to reorder"
          onMouseEnter={() => setDragEnabled(true)}
          onMouseLeave={() => setDragEnabled(false)}
        >
          {I.grip}
        </div>
        <span className="note-tag">
          {I.note}
          Note
        </span>
        <button className="hover-del" title="Delete note" onClick={onDelete}>
          {I.trash}
        </button>
      </div>
      <textarea
        ref={ref}
        className="note-text"
        value={text}
        rows={1}
        placeholder="Write context, a heading, or instructions for this section…"
        onChange={(e) => {
          onEdit(e.target.value);
          fit(e.target);
        }}
      />
    </div>
  );
}

/* ════ GROUP / SECTION ══════════════════════════════════════════════ */
function GroupSection({
  group,
  gi,
  baseNum,
  states,
  active,
  running,
  onToggle,
  onTitle,
  onRunGroup,
  onDelGroup,
  onAddStep,
  stepHandlers,
}) {
  const cmdItems = group.items.filter((i) => i.type !== "text");
  const pips = cmdItems.map((it) => (states[it.id] || {}).status || "idle");
  let ci = baseNum;

  return (
    <div className={`group${group.collapsed ? " collapsed" : ""}`}>
      <div className="group-head">
        <button className="group-caret" title={group.collapsed ? "Expand section" : "Collapse section"} onClick={onToggle}>
          {I.caret}
        </button>
        <span className="group-kicker">{String(gi + 1).padStart(2, "0")}</span>
        <input
          className="group-title"
          value={group.title}
          onChange={(e) => onTitle(e.target.value)}
          spellCheck={false}
        />
        <span className="group-count">
          {cmdItems.length} {cmdItems.length === 1 ? "step" : "steps"}
        </span>
        <span className="group-pips">
          {pips.map((s, i) => (
            <span key={i} className={`pip ${s === "idle" ? "" : s}`} />
          ))}
        </span>
        <span className="group-spacer" />
        <button
          className="group-run"
          title="Run all steps in this section"
          disabled={running}
          onClick={onRunGroup}
        >
          {I.playAll}
          Run section
        </button>
        <button className="hover-del group-del" title="Delete section" onClick={onDelGroup}>
          {I.trash}
        </button>
      </div>
      {!group.collapsed && (
        <div
          className="group-body"
          onDragOver={(e) => {
            if (stepHandlers.draggedItemId) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            if (stepHandlers.draggedItemId) {
              stepHandlers.onDrop(e, null, group.id);
            }
          }}
        >
          {group.items.map((it) => {
            if (it.type === "text") {
              return (
                <TextBlock
                  key={it.id}
                  id={it.id}
                  text={it.text || ""}
                  onEdit={(t) => stepHandlers.editText(it.id, t)}
                  onDelete={() => stepHandlers.del(it.id)}
                  draggedItemId={stepHandlers.draggedItemId}
                  dragOverItemId={stepHandlers.dragOverItemId}
                  onDragStart={() => stepHandlers.onDragStart(it.id, group.id)}
                  onDragEnd={stepHandlers.onDragEnd}
                  onDragOver={(e) => stepHandlers.onDragOver(e, it.id)}
                  onDragLeave={() => stepHandlers.onDragLeave(it.id)}
                  onDrop={(e) => stepHandlers.onDrop(e, it.id, group.id)}
                />
              );
            }
            const idx = ci++;
            return (
              <StepCard
                key={it.id}
                idx={idx}
                step={it}
                state={states[it.id] || { status: "idle" }}
                active={active === it.id}
                collapsed={!!it.collapsed}
                onToggle={() => stepHandlers.toggleCollapse(it.id)}
                onRun={() => stepHandlers.run(it.id)}
                onEdit={(c) => stepHandlers.editStep(it.id, c)}
                onTitle={(t) => stepHandlers.editTitle(it.id, t)}
                onJump={stepHandlers.jump}
                onDelete={() => stepHandlers.del(it.id)}
                draggedItemId={stepHandlers.draggedItemId}
                dragOverItemId={stepHandlers.dragOverItemId}
                onDragStart={() => stepHandlers.onDragStart(it.id, group.id)}
                onDragEnd={stepHandlers.onDragEnd}
                onDragOver={(e) => stepHandlers.onDragOver(e, it.id)}
                onDragLeave={() => stepHandlers.onDragLeave(it.id)}
                onDrop={(e) => stepHandlers.onDrop(e, it.id, group.id)}
              />
            );
          })}
          <div className="add-row">
            <button className="add-step" onClick={() => onAddStep("cmd")}>
              {I.plus}
              Add step
            </button>
            <button className="add-step" onClick={() => onAddStep("text")}>
              {I.note}
              Add text
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ MAIN SCRATCHPAD ══════════════════════════════════════════════ */
function Scratchpad({
  groups,
  states,
  active,
  running,
  fileName,
  leftPaneWidth,
  theme,
  stepHandlers,
  onGroupsChange,
  addGroup,
  delGroup,
  toggleGroup,
  editGroupTitle,
  runGroup,
  addItem,
}) {
  const [draggedItemId, setDraggedItemId] = React.useState(null);
  const [draggedGroupId, setDraggedGroupId] = React.useState(null);
  const [dragOverItemId, setDragOverItemId] = React.useState(null);

  const handleDragStart = (itemId, groupId) => {
    setDraggedItemId(itemId);
    setDraggedGroupId(groupId);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDraggedGroupId(null);
    setDragOverItemId(null);
  };

  const handleDragOver = (e, itemId) => {
    e.preventDefault();
    if (draggedItemId === itemId) return;
    setDragOverItemId(itemId);
  };

  const handleDragLeave = (itemId) => {
    if (dragOverItemId === itemId) {
      setDragOverItemId(null);
    }
  };

  const handleDrop = (e, targetItemId, targetGroupId) => {
    e.preventDefault();
    if (!draggedItemId) {
      handleDragEnd();
      return;
    }

    if (targetItemId && draggedItemId === targetItemId) {
      handleDragEnd();
      return;
    }

    const newGroups = groups.map(g => ({
      ...g,
      items: [...g.items]
    }));

    // Find and remove source item
    let sourceItem = null;
    let sourceGroup = newGroups.find(g => g.id === draggedGroupId);
    if (sourceGroup) {
      const idx = sourceGroup.items.findIndex(it => it.id === draggedItemId);
      if (idx !== -1) {
        sourceItem = sourceGroup.items[idx];
        sourceGroup.items.splice(idx, 1);
      }
    }

    if (!sourceItem) {
      handleDragEnd();
      return;
    }

    // Find target and insert
    let targetGroup = newGroups.find(g => g.id === targetGroupId);
    if (targetGroup) {
      if (targetItemId) {
        const idx = targetGroup.items.findIndex(it => it.id === targetItemId);
        if (idx !== -1) {
          targetGroup.items.splice(idx, 0, sourceItem);
        } else {
          targetGroup.items.push(sourceItem);
        }
      } else {
        targetGroup.items.push(sourceItem);
      }
    }

    onGroupsChange(newGroups);
    handleDragEnd();
  };

  const enhancedHandlers = {
    ...stepHandlers,
    draggedItemId,
    dragOverItemId,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop
  };

  const allItems = groups.flatMap((g) => g.items);
  const cmdCount = allItems.filter((s) => s.type !== "text").length;
  const doneCount = Object.values(states).filter((s) =>
    ["ok", "warn", "error"].includes(s.status)
  ).length;

  return (
    <div className={`left-pane ${theme}`} style={{ width: `${leftPaneWidth}%`, flex: 'none' }}>
      <div className="rb-head">
        <h1>{fileName || "Promptly"}</h1>
        <span className="meta">{cmdCount} steps</span>
        <span className="spacer" />
        <div className="progress">
          <span>
            {doneCount}/{cmdCount}
          </span>
          <div className="track">
            <div className="fill" style={{ width: `${cmdCount ? (doneCount / cmdCount) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="runbook">
        {(() => {
          let base = 0;
          return groups.map((g, gi) => {
            const node = (
              <GroupSection
                key={g.id}
                group={g}
                gi={gi}
                baseNum={base}
                states={states}
                active={active}
                running={running}
                onToggle={() => toggleGroup(g.id)}
                onTitle={(t) => editGroupTitle(g.id, t)}
                onRunGroup={() => runGroup(g.id)}
                onDelGroup={() => delGroup(g.id)}
                onAddStep={(kind) => addItem(g.id, kind)}
                stepHandlers={enhancedHandlers}
              />
            );
            base += g.items.filter((i) => i.type !== "text").length;
            return node;
          });
        })()}
        <button className="add-group" onClick={addGroup}>
          {I.plus}
          Add section
        </button>
      </div>
    </div>
  );
}

export default Scratchpad;
